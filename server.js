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

    // 3. 取得したデータを4時間キャッシュに保存
    // TTLは cache.js で設定されている (4時間)
    // lru-cacheの max 制限により、4時間前に消える可能性はあります。
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
// 残り時間を「時間、分、秒」で表示
// =======================================================
app.get('/api/cache', (req, res) => {
  const cacheStatus = [];
  const keys = Array.from(cache.keys());

  keys.forEach(videoid => {
    // getRemainingTTL で残り時間 (ミリ秒) を取得
    const remainingMs = cache.getRemainingTTL(videoid);
    
    if (remainingMs > 0) {
        let remainingSeconds = Math.ceil(remainingMs / 1000);
        
        // 1. 時間の計算 (1時間は3600秒)
        const hours = Math.floor(remainingSeconds / 3600); 
        remainingSeconds %= 3600; 

        // 2. 分の計算
        const minutes = Math.floor(remainingSeconds / 60);
        
        // 3. 秒の計算
        const seconds = remainingSeconds % 60;

        // 表示文字列の生成 (〇〇時間 〇〇分 〇〇秒 形式)
        let timeString = '';
        if (hours > 0) {
            timeString += `${hours}時間 `;
        }
        timeString += `${minutes}分 ${seconds}秒`;

        cacheStatus.push({
            videoid: videoid,
            // 時間、分、秒に変換して表示
            remainingTime: timeString.trim(),
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
// Vercel/Renderでのデプロイ対応 (サーバー起動ロジックの分離)
// =======================================================

/**
 * サーバーを起動する関数
 */
function startServer() {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`);
    });
}

// サーバーレス環境 (Vercel/Netlifyなど) 向けのエクスポート
// Vercelなどはこのエクスポートされたappオブジェクトを呼び出します。
export default app; 

// ローカル実行またはRenderなどのフルスタック環境の場合、
// ファイルが直接実行されたときにサーバーを起動します。
// import/exportを使用しているため、この判定は動作しません。
// 動作保証のため、明示的に呼び出します。
startServer();
