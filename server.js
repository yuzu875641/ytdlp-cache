import express from 'express';
import fetch from 'node-fetch';
import cache from './cache.js'; 

const app = express();

const EXTERNAL_API_BASE = 'https://yt-dl-test.vercel.app/dl/';

// =======================================================
// ルート 1: /dl/:videoid (キャッシュありデータ取得)
// =======================================================
app.get('/dl/:videoid', async (req, res) => {
  const { videoid } = req.params;
  const cacheKey = videoid;

  // 1. キャッシュの確認
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    console.log(`Cache hit: ${videoid}`);
    return res.status(200).json(cachedData);
  }

  // 2. キャッシュがない場合、外部APIから取得
  console.log(`Cache miss. Fetching: ${videoid}`);
  try {
    const externalUrl = `${EXTERNAL_API_BASE}${videoid}`;
    const response = await fetch(externalUrl);

    // 外部APIのエラー応答をそのまま転送
    if (!response.ok) {
        // JSONパース失敗の可能性も考慮
        const errorData = await response.json().catch(() => ({ message: 'External API error' })); 
        return res.status(response.status).json(errorData);
    }
    
    const data = await response.json();

    // 3. 取得したデータを1時間キャッシュに保存
    cache.set(cacheKey, data);
    
    // 4. データを応答
    return res.status(200).json(data);

  } catch (error) {
    console.error(`Error for ${videoid}:`, error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =======================================================
// ルート 2: /api/cache (キャッシュ情報表示)
// =======================================================
app.get('/api/cache', (req, res) => {
  const cacheStatus = [];
  const keys = Array.from(cache.keys());

  keys.forEach(videoid => {
    // getRemainingTTL で残り時間 (ミリ秒) を取得
    const remainingMs = cache.getRemainingTTL(videoid);
    
    if (remainingMs > 0) {
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        cacheStatus.push({
            videoid: videoid,
            // 分と秒に変換して表示
            remainingTime: `${Math.floor(remainingSeconds / 60)}分 ${remainingSeconds % 60}秒`,
            remainingTTL_ms: remainingMs
        });
    }
  });

  return res.status(200).json({
    totalCachedItems: cacheStatus.length,
    cacheDetails: cacheStatus
  });
});

// =======================================================
// Vercelでのデプロイのために Express app をエクスポート
// =======================================================
export default app; 

// ローカルでのテスト実行用 
// Vercel環境では、Serverless Functionとしてラップされるため、この部分は実行されません。
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}
