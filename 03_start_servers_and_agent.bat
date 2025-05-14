@echo off

REM アプリケーションのルートディレクトリを環境変数に設定
REM %~dp0 はバッチファイルが置かれているディレクトリのパスを末尾に\付きで取得します
SET "APP_ROOT=%~dp0"

echo ======================================================
echo  Mastra-CRS-MCP: MCPサーバー & Agent 起動スクリプト
echo ======================================================
echo.
echo アプリケーションルートディレクトリ: %APP_ROOT%
echo.


REM --- 多重起動の検知 (PowerShellスクリプトを使用) ---
echo 既存の関連プロセスをチェックしています...

REM PowerShellスクリプトにポート番号を渡して実行
REM -ExecutionPolicy Bypass は、スクリプト実行ポリシーを一時的に回避（注意が必要）
REM & は Invoke-Expression のエイリアスとして、スクリプトを実行
PowerShell -ExecutionPolicy Bypass -File "%APP_ROOT%check_port.ps1" 3001 3002 4111

REM PowerShellスクリプトの終了コードを取得
REM check_port.ps1 は起動していれば 1、そうでなければ 0 を返す設計
if errorlevel 1 (
    REM PowerShellスクリプトがエラー終了コードを返した場合（起動中と判断）
    REM check_port.ps1内でメッセージは表示済み
    pause
    EXIT /B 1 REM バッチファイルもエラー終了
)

echo.
REM --- 多重起動の検知 (ここまで) ---


REM 各Node.jsプロジェクトの依存インストールとビルド、そして起動を行います。
REM 新しいウィンドウで実行し、Ctrl+Cで終了しないように /k オプションを使用します。
REM 環境変数 APP_ROOT を引き継ぎます。

REM --- crs-mcp-law-server (法令解析 MCP サーバー) のセットアップと起動 ---
echo --- 1. 法令解析 MCP サーバーのセットアップ (crs-mcp-law-server) ---
cd crs-mcp-law-server
dir
if exist node_modules\ (
    echo node_modules が存在します。依存インストールをスキップします。
) else (
    echo 依存パッケージをインストールしています...
    npm install
    if errorlevel 1 goto npm_error
    echo 依存パッケージのインストールが完了しました。
)

echo 法令解析 MCP サーバーを起動します (新しいウィンドウ)...
REM start "Law Server" cmd /k npm run dev
start "Law Server" cmd /k npm run dev

echo.

REM --- crs-mcp-scraper-server (スクレイパー MCP サーバー) のセットアップと起動 ---
echo --- 2. スクレイパー MCP サーバーのセットアップ (crs-mcp-scraper-server) ---
cd ..
cd crs-mcp-scraper-server
if exist node_modules\ (
    echo node_modules が存在します。依存インストールをスキップします。
) else (
    echo 依存パッケージをインストールしています...
    npm install
    if errorlevel 1 goto npm_error
    echo 依存パッケージのインストールが完了しました。
)

echo スクレイパー MCP サーバーを起動します (新しいウィンドウ)...
REM start "Scraper Server" cmd /k npm run dev
start "Scraper Server" cmd /k npm run dev
echo.

REM --- mastra (Mastra Agent アプリケーション) のセットアップと起動 ---
echo --- 3. Mastra Agent アプリケーションのセットアップ (mastra) ---
cd ..
cd mastra
if exist node_modules\ (
    echo node_modules が存在します。依存インストールをスキップします。
) else (
    echo 依存パッケージをインストールしています...
    npm install
    if errorlevel 1 goto npm_error
    echo 依存パッケージのインストールが完了しました。
)

echo Mastra Agent を起動します (新しいウィンドウ)...
REM start "Mastra Agent" cmd /k npm run dev"
start "Mastra Agent" cmd /k npm run dev

timeout /t 15 /nobreak > NUL
echo Webブラウザで http://localhost:4111/ にアクセスしてください。
start chrome.exe "http://localhost:4111/"
echo.

echo ======================================================
echo  "すべてのサーバーと Agent の起動コマンドを発行しました。"
echo  "各ウィンドウを確認してください。"
echo  "このウィンドウは自動的に閉じます。"
echo ======================================================
goto end

:npm_error
echo ======================================================
echo  エラー: npm コマンドの実行に失敗しました。
echo  インターネット接続を確認し、Node.jsとnpmが正しく
echo  インストールされているか確認してください。
echo  エラー詳細は上記のメッセージを確認してください。
echo ======================================================
pause

:end
EXIT /B %errorlevel%