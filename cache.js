import { LRUCache } from 'lru-cache';

// キャッシュの設定: 1時間 (1000ミリ秒 * 60秒 * 60分)
const options = {
  max: 500,
  ttl: 1000 * 60 * 60, 
  allowStale: false,
  updateAgeOnGet: false,
  updateAgeOnHas: false,
};

const cache = new LRUCache(options);

export default cache;
