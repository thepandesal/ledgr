import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

export const compressImage = async (uri: string): Promise<string> => {
  const r = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return r.uri;
};

const decode = (base64: string): Uint8Array => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const bytes = Math.floor(base64.length * 0.75);
  const result = new Uint8Array(bytes);
  let j = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const a = lookup[base64.charCodeAt(i)], b = lookup[base64.charCodeAt(i + 1)];
    const c = lookup[base64.charCodeAt(i + 2)], d = lookup[base64.charCodeAt(i + 3)];
    result[j++] = (a << 2) | (b >> 4);
    result[j++] = ((b & 15) << 4) | (c >> 2);
    result[j++] = ((c & 3) << 6) | d;
  }
  return result;
};

/** Uploads a photo URI to Supabase and inserts a receipt_photos row.
 *  Returns { id, url, path } on success, null on failure. */
export const uploadReceiptPhoto = async (
  uri: string,
  entryId: string
): Promise<{ id: string; url: string; path: string } | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const fileName = `${user.id}/${entryId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;

  let uploadData: Uint8Array | Blob;
  if (typeof window !== 'undefined' && (uri.startsWith('blob:') || uri.startsWith('data:'))) {
    uploadData = await fetch(uri).then(r => r.blob());
  } else {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    uploadData = decode(b64);
  }

  const { error } = await supabase.storage.from('receipts').upload(fileName, uploadData, { contentType: 'image/jpeg' });
  if (error) throw error;

  const { data: row } = await supabase.from('receipt_photos').insert({ entry_id: entryId, storage_path: fileName }).select().single();
  const { data: signed } = await supabase.storage.from('receipts').createSignedUrl(fileName, 3600);

  if (!row || !signed) return null;
  return { id: row.id, url: signed.signedUrl, path: fileName };
};
