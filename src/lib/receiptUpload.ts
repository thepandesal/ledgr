import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { Platform } from 'react-native';

const R2_ENDPOINT = process.env.EXPO_PUBLIC_R2_ENDPOINT!;
const R2_ACCESS_KEY = process.env.EXPO_PUBLIC_R2_ACCESS_KEY!;
const R2_SECRET_KEY = process.env.EXPO_PUBLIC_R2_SECRET_KEY!;
const R2_BUCKET = process.env.EXPO_PUBLIC_R2_BUCKET!;
const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL!;

const ALLOWED_DOMAINS = ['supabase.co', 'supabase.in', 'ledgr.art', 'amazonaws.com'];

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_DOMAINS.some(domain => parsed.hostname.endsWith(domain));
  } catch {
    return false;
  }
}

export const compressImage = async (uri: string): Promise<string> => {
  if (Platform.OS === 'web') {
    // Web compression via canvas
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const MAX = 900;
        const scale = img.width > MAX ? MAX / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.65));
      };
      img.onerror = () => resolve(uri);
      img.src = uri;
    });
  }
  const r = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 900 } }],
    { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG }
  );
  return r.uri;
};

// HMAC-SHA256 for AWS Signature V4
const hmacSha256 = async (key: ArrayBuffer | string, data: string): Promise<ArrayBuffer> => {
  const keyData = typeof key === 'string'
    ? new TextEncoder().encode(key)
    : new Uint8Array(key);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
};

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

const sha256 = async (data: ArrayBuffer | string): Promise<string> => {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return toHex(await crypto.subtle.digest('SHA-256', buf));
};

const uploadToR2 = async (fileName: string, body: ArrayBuffer): Promise<string> => {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateShort = dateStr.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const host = R2_ENDPOINT.replace('https://', '');
  const url = `${R2_ENDPOINT}/${R2_BUCKET}/${fileName}`;

  const payloadHash = await sha256(body);
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${dateStr}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `PUT\n/${R2_BUCKET}/${fileName}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${dateShort}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${dateStr}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

  const kDate = await hmacSha256(`AWS4${R2_SECRET_KEY}`, dateShort);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = toHex(await hmacSha256(kSigning, stringToSign));
  const authorization = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': authorization,
      'Content-Type': 'image/jpeg',
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': dateStr,
    },
    body,
  });

  if (!res.ok) throw new Error(`R2 upload failed: ${res.status} ${await res.text()}`);
  return `${R2_PUBLIC_URL}/${fileName}`;
};

const uploadToSupabase = async (fileName: string, buffer: ArrayBuffer): Promise<string> => {
  const { error } = await supabase.storage.from('receipts').upload(fileName, buffer, { contentType: 'image/jpeg' });
  if (error) throw error;
  const { data } = await supabase.storage.from('receipts').createSignedUrl(fileName, 3600 * 24 * 365);
  return data?.signedUrl ?? '';
};

export const FREE_RECEIPT_LIMIT = 10;

/** Returns how many receipt photos the user has uploaded this calendar month */
export const getMonthlyReceiptCount = async (userId: string): Promise<number> => {
  const start = new Date();
  start.setDate(1); start.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('receipt_photos')
    .select('id, receipt_entries!inner(user_id)', { count: 'exact', head: true })
    .eq('receipt_entries.user_id', userId)
    .gte('receipt_photos.created_at', start.toISOString());
  return count ?? 0;
};

/** Uploads a photo URI — uses Supabase on web (CORS safe), R2 on native */
export const uploadReceiptPhoto = async (
  uri: string,
  entryId: string
): Promise<{ id: string; url: string; path: string } | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Enforce monthly free limit
  const monthlyCount = await getMonthlyReceiptCount(user.id);
  if (monthlyCount >= FREE_RECEIPT_LIMIT) {
    throw new Error('RECEIPT_LIMIT_REACHED');
  }

  const fileName = `${user.id}/${entryId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;

  let buffer: ArrayBuffer;
  if (typeof window !== 'undefined' && uri.startsWith('blob:')) {
    buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', uri);
      xhr.responseType = 'arraybuffer';
      xhr.onload = () => resolve(xhr.response as ArrayBuffer);
      xhr.onerror = () => reject(new Error('blob read failed'));
      xhr.send();
    });
  } else if (typeof window !== 'undefined' && uri.startsWith('data:')) {
    const base64 = uri.split(',')[1];
    if (!base64) throw new Error('blocked: malformed data URI');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    buffer = bytes.buffer;
  } else if (typeof window !== 'undefined') {
    throw new Error('blocked: unsupported URI scheme');
  } else {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    buffer = bytes.buffer;
  }

  // Web: use Supabase Storage (avoids CORS issues with R2 direct upload)
  // Native: use R2
  let publicUrl: string;
  if (Platform.OS === 'web') {
    publicUrl = await uploadToSupabase(fileName, buffer);
  } else {
    if (!isSafeUrl(`${R2_ENDPOINT}/${R2_BUCKET}/${fileName}`)) throw new Error('blocked: untrusted URL');
    publicUrl = await uploadToR2(fileName, buffer);
  }

  if (!publicUrl || !isSafeUrl(publicUrl)) throw new Error('blocked: untrusted public URL');

  const { data: row } = await supabase
    .from('receipt_photos')
    .insert({ entry_id: entryId, storage_path: fileName, url: publicUrl })
    .select()
    .single();

  if (!row) return null;
  return { id: row.id, url: publicUrl, path: fileName };
};
