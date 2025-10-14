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

  // 1. キャッシュの確認 (高速応答ポイント)
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
        const errorData = await response.json().catch(() => ({ message: 'External API error' })); 
        return res.status(response.status).json(errorData);
    }
    
    const data = await response.json();

    // 3. 取得したデータを1時間キャッシュに保存
    // TTLは cache.js で設定されている (1時間)
    // lru-cacheの max 制限により、1時間前に消える可能性はあります。
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
// Vercel/Renderでのデプロイ対応 (重要: サーバー起動処理)
// =======================================================

// Express app をエクスポート (Vercelなどサーバーレス環境用)
export default app; 

// Render環境またはローカルでのテスト実行用
// Renderは環境変数PORTを渡すため、アプリが必ず Listen するようにします。
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    // このメッセージが Render のログに出力されれば、起動成功です。
    console.log(`Server is listening on port ${PORT}`);
});
