type Listener = () => void;

const now = new Date();
let _month = now.getMonth(); // 0-indexed
let _year  = now.getFullYear();
const _listeners = new Set<Listener>();

function notify() { _listeners.forEach(fn => fn()); }

export const dateFilter = {
  getMonth: () => _month,
  getYear:  () => _year,
  set: (month: number, year: number) => {
    _month = month;
    _year  = year;
    notify();
  },
  subscribe:   (fn: Listener) => { _listeners.add(fn);    return () => _listeners.delete(fn); },
  getFromTo: () => {
    const daysInMonth = new Date(_year, _month + 1, 0).getDate();
    const mm = String(_month + 1).padStart(2, '0');
    return {
      from: `${_year}-${mm}-01`,
      to:   `${_year}-${mm}-${String(daysInMonth).padStart(2, '0')}`,
    };
  },
};

export const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
