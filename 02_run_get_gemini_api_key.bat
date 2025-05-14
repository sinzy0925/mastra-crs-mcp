@echo off
chcp 65001 > nul


echo ======================================================
echo  Mastra-CRS-MCP: Gemini APIキー設定
echo ======================================================
echo.
echo Gemini (Google Generative AI) の API キーを設定します。
echo.
echo "以下のページをWebブラウザで開いて、API キーを取得してください。"
echo "API キー の取得には Google アカウントが必要です。"
echo.
echo https://aistudio.google.com/apikey
echo.
echo 上記URLをブラウザで開きます...
echo.

REM Gemini APIキー取得ページをブラウザで開く
start "" "https://aistudio.google.com/apikey"
echo ブラウザが開かない場合は、上記のURLをコピーして手動で開いてください。
echo.

echo ------------------------------------------------------
echo "ブラウザで API キーを取得したら、以下に貼り付けて Enter を押してください。"
echo "(キーは画面に表示されません)"
echo ------------------------------------------------------

set /p GEMINI_API_KEY=APIキーを入力してください: 

echo.
echo 入力されたキー: %GEMINI_API_KEY:~0,5%...

REM APIキーを .env ファイルに書き込む
REM .env ファイルがなければ新規作成、あれば追記または更新

echo GOOGLE_GENERATIVE_AI_API_KEY=%GEMINI_API_KEY% > mastra\.env

echo.
echo ======================================================
echo  APIキーを mastra\.env に保存しました。
echo ======================================================
echo.
echo "これで認証とAPIキーの設定は完了です。"
echo "次に、03_start_servers_and_agent.batを実行してアプリケーションを起動してください。"
echo.
start 03_start_servers_and_agent.bat
EXIT /B 0