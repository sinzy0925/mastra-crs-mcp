# Mastra-CRS-MCP: MCP連携型 Web 操作ツール

## このアプリケーションは、Windows10 またはそれ以上で稼働することを前提としています。
## ローカルＰＣ上で動かすことを前提としています。

Mastra-CRS-MCP は、Model Context Protocol (MCP) を活用し、LLM (大規模言語モデル) がローカルで実行される高機能な Web 操作ツール (Playwright ベースのスクレイパーや法令解析ツール) と連携できるようにするアプリケーション群です。

本プロジェクトに含まれるツール群を使用することで, AI エージェントはまるで人間のように Web ブラウザを操作し、情報を取得・解析することが可能になります。

**【重要】本アプリケーションには、Playwright を用いて Web ブラウザ操作を行う複数の実行可能ファイル（.exe）が含まれます。これらのファイルはクローズドソースであり、その利用には認証および利用制限（月100回利用可能な無料枠あり、上限を超える場合は課金が必要となる可能性があります）が伴います。**

## アプリケーション構成

本プロジェクトは、以下の主要コンポーネントで構成されます。

-   **Playwright 実行ファイル群 (`.exe`)**:
    -   `01_run_get_crs_api_key.exe`: **【必須】** 本アプリのブラウザ操作機能（.exeファイル）の利用に必要なAPIキーを取得・管理するための認証設定ツール。
    -   `chrome-recorder.exe`: 新しい Web 操作手順を記録・生成を支援するツール。
    -   `chrome-auto-scraper.exe`: 汎用的な Web スクレイピングタスクを実行するツール。
    -   `chrome-law-analyzer.exe`: e-Gov 法令 HTML から特定のキーワードを検索・解析するツール。
    -   **これらの `.exe` ファイルはクローズドソースです。**
-   **MCP サーバー群 (Node.js アプリケーション)**:
    -   `crs-mcp-scraper-server`: `chrome-auto-scraper.exe` をツールとして公開するサーバー (デフォルトポート: 3001)。
    -   `crs-mcp-law-server`: `chrome-law-analyzer.exe` をツールとして公開するサーバー (デフォルトポート: 3002)。
    -   これらのサーバーは、`@modelcontextprotocol/sdk` を使用し、HTTP 経由でツール呼び出しリクエストを受け付けます。
-   **Mastra Agent (Node.js アプリケーション)**:
    -   LLM (例: Google Gemini, OpenAI GPT) が動作する環境 (例: Dify, LangChain) と連携し、ユーザーの自然言語による指示を解釈して適切な MCP サーバー上のツールを呼び出し、結果を返します。
    -   `@mastra/core` および `@mastra/mcp` を利用します。

## ファイル構成

展開後の主要なファイル構成は以下の通りです。ユーザーさんが直接操作する重要なファイル（README、認証ツール、記録ツール、起動バッチ）は、`mastra-crs-mcp` のルートディレクトリに配置されています。

```
mastra-crs-mcp/
├── README.MD                 <-- このファイル (最初に読んでください)
├── 01_run_get_crs_api_key.exe    <-- ★最初に実行する認証ツール★
├── 02_run_get_gemini_api_key.bat <-- ★GeminiのAPIキーを取得するバッチ★
├── 02_start_servers_and_agent.bat <-- ★次に実行するサーバー起動バッチ★
├── chrome-recorder.exe       <-- ★操作記録に使いたい場合に実行★
├── crs-mcp-law-server/       <-- 法令解析 MCP サーバー (Node.js アプリケーション)
│   ├── ...                   (package.json, tsconfig.json, etc.)
│   ├── bin/                    <-- 法令解析サーバーが使用するEXEと設定セット
│   │   ├── chrome-law-analyzer.exe  <-- Law Serverから呼び出される実行ファイル
│   │   └── setdir_name/          <-- 法令解析タスク用の設定フォルダ群 (例: kenchiku-kijunhou)
│   │       ├── playwright_steps_logic.py
│   │       └── playwright_steps_param.txt
│   └── src/server.ts         <-- 法令解析 MCP サーバーのソースコード
└── crs-mcp-scraper-server/   <-- スクレイパー MCP サーバー (Node.js アプリケーション)
    ├── ...                   (package.json, tsconfig.json, etc.)
    ├── bin/                    <-- スクレイパーサーバーが使用するEXEと設定セット
    │   ├── chrome-auto-scraper.exe  <-- Scraper Serverから呼び出される実行ファイル
    │   └── setdir_name/          <-- スクレイピングタスク用の設定フォルダ群 (例: google--search_query, pmda--search_query)
    │       ├── playwright_steps_logic.py
    │       └── playwright_steps_param.txt
    └── src/server.ts         <-- スクレイパー MCP サーバーのソースコード
└── mastra/                   <-- Mastra Agent アプリケーション (Node.js アプリケーション)
    └── ...                   (package.json, tsconfig.json, etc.)
```
※ `chrome-auto-scraper.exe` および `chrome-law-analyzer.exe` はそれぞれの MCP サーバーの `bin` ディレクトリ内に配置されています。各サーバーは起動時に自身の `bin` ディレクトリ内の EXE を参照します。

## はじめに - セットアップ手順

本アプリケーションを利用するためには、以下のステップを **順番に** 実行する必要があります。

### **STEP 1: Node.js と npm のインストール**

MCP サーバーおよび Mastra Agent は Node.js で動作します。Node.js (v18 以上推奨) と npm がインストールされていない場合は、以下の公式サイトからダウンロードしてインストールしてください。

[Node.js 公式サイト](https://nodejs.org/)

インストール時に「Add to PATH」のオプションを有効にしてください。インストール後、新しいターミナル（コマンドプロンプトなど）を開き、以下のコマンドを実行し、正しくインストールされているか確認してください。

```bash
node -v
npm -v
```

### **STEP 2: アプリケーションファイルの展開**

配布された圧縮ファイル (`mastra-crs-mcp.zip` など) を任意のフォルダに展開してください。展開したフォルダのパスに日本語や特殊文字が含まれない方が、予期せぬエラーを防ぐ上で安全です。

https://github.com/sinzy0925/mastra-crs-mcp から以下のいずれかの方法でダウンロードしてください。

1.  **手動ダウンロード**: 上記URLの画面中央右よりの緑色の「<>Code」をクリックして、Download ZIPをクリックしてダウンロードする。
2.  **Git Clone**: Git がインストールされている場合は、コマンドプロンプトで以下のコマンドを実行します。
    ```cmd
    git clone https://github.com/sinzy0925/mastra-crs-mcp.git
    ```

### **STEP 3: 【最重要かつ最初】APIキーの設定**

**このステップは、本アプリケーションのブラウザ操作機能（`.exe` ファイル群）を利用するために必須です。Playwright による実際の Web ブラウザ操作は、認証済みの有効な API キーがある場合にのみ実行できます。**

展開したフォルダのルートディレクトリにある **`01_run_get_crs_api_key.exe`** をダブルクリックして実行してください。このツールは、安全な方法で認証を行い、実行に必要な API キーを OS のセキュアストレージに保存します。

以下に、`01_run_get_crs_api_key.exe` の詳細な手順を示します。

1.  エクスプローラーで、展開した `mastra-crs-mcp` フォルダを開きます。
2.  ルートディレクトリにある **`01_run_get_crs_api_key.exe` をダブルクリックして起動します。**
3.  黒いコンソールウィンドウが表示され、認証フローの開始がログ表示されます。
4.  **数秒後、Google の認証ページがブラウザで自動的に起動します。** もしブラウザが開かない場合は、コンソールウィンドウに表示される URL をコピーし、手動でブラウザで開いてください。
5.  コンソールウィンドウに、「ワンタイムコードをコピー済です」というメッセージと共に **ワンタイムコード (例: XXXXXXXX)** が表示されます。このコードはクリップボードに自動的にコピーされています。
6.  ブラウザで開かれた Google の認証ページで、**ワンタイムコード を入力**し、「次へ」または「続行」をクリックします。
7.  本アプリケーションが Google アカウント情報にアクセスするための権限要求画面が表示されます。内容を確認し、**許可**してください。
8.  ブラウザでの許可が完了したら、**`01_run_get_crs_api_key.exe` が起動しているコンソールウィンドウ**に戻ります。コンソールで「Authorization successful!」など、処理が進んでいることを確認してください。
9.  Google からの応答後、Firebase Auth と連携し、API キーを取得する処理が自動的に続行されます。
10. 最終的な API キー の取得と OS セキュアストレージへの保存が成功したかどうかのメッセージボックスが表示されます。
    *   **「Setup Complete」** というタイトルのメッセージボックスが表示されれば成功です。これで本アプリケーションのブラウザ操作機能を使用する準備ができました。
    *   **「API Key Error」** やその他のエラー（Network Error, Authentication Error, Critical Error など）が表示された場合は、認証または API キー取得に失敗しています。表示されたエラーメッセージをよく確認してください。インターネット接続が安定しているか、Google アカウントへのアクセス許可が正しく行われているかなどが原因として考えられます。メッセージボックスを閉じ、再度 `01_run_get_api_key.exe` を実行してください。
11. メッセージボックスを閉じ、コンソールウィンドウが自動的に閉じれば設定完了です。

**認証の必要性について:**

本アプリケーションに含まれる `.exe` ファイルは、その機能の性質上、無制限な利用を防ぐために認証メカニズムを導入しています。`01_run_get_crs_api_key.exe` はこの認証プロセスを代行し、ユーザーの Google アカウントと紐づいた API キーを生成または取得します。この API キーは、各 `.exe` ファイルの実行時に自動的に読み込まれ、利用権限の検証に使用されます。

もし API キーが設定されていない場合、または期限切れなどの理由で無効になっている場合、`.exe` ファイル（`chrome-auto-scraper.exe` や `chrome-law-analyzer.exe`）の実行は拒否され、エラーメッセージが表示されます。

API キーの利用状況によっては、無料枠の上限に達した場合などに利用が制限される可能性があります。ご了承ください。（月間無料利用枠：100回を想定）


### **STEP 4: Gemini APIキーの設定**
**このステップは、Mastra Agent を通じて LLM (Google Gemini) と対話するために必須です。**

展開したフォルダのルートディレクトリにある 02_run_get_gemini_api_key.bat をダブルクリックして実行してください。このバッチファイルが、Google AI Studio の API キー取得ページを開き、ユーザーに入力してもらった API キーを mastra/.env ファイルに保存します。

以下に、02_run_get_gemini_api_key.bat の詳細な手順を示します。

1. エクスプローラーで、展開した mastra-crs-mcp フォルダを開きます。
2. ルートディレクトリにある 02_run_get_gemini_api_key.bat をダブルクリックして起動します。
3. 黒いコンソールウィンドウが表示され、Gemini API キー設定プロセスに関するメッセージが表示されます。
4. **Google AI Studio の API キー取得ページがブラウザで自動的に起動します。** もしブラウザが開かない場合は、コンソールに表示される URL (https://aistudio.google.com/apikey) をコピーし、手動でブラウザで開いてください。
5. ブラウザで、新しい API キーを作成するか、既存のキーを確認します。
6. **取得した API キーをコピーします。**
7. 02_run_get_gemini_api_key.bat **が起動しているコンソールウィンドウに戻ります。** プロンプトが表示されているので、**コピーした API キーを貼り付け、Enter キーを押してください。** (入力内容は画面に表示されません)
8. 入力された API キーが mastra フォルダ内の .env ファイルに GOOGLE_GENERATIVE_AI_API_KEY=<入力したキー> という形式で保存されます。
9. API キーが保存された旨のメッセージが表示されたら、設定完了です。コンソールウィンドウを閉じてください。

**Gemini APIキー認証の必要性について:**

Mastra Agent が Google Gemini モデルを利用して応答を生成するためには、有効な Gemini API キーが必要です。このキーは .env ファイルに保存され、Mastra Agent が起動時に読み込みます。このキーがない場合、Agent は LLM モデルにアクセスできず、応答できません。


### **STEP 5: MCP サーバーと Mastra Agent の起動**

API キー設定が完了し、ブラウザ操作機能を利用する準備ができたら、MCP サーバー群と Mastra Agent を起動します。

**STEP 4: Gemini APIキーの設定**で、 **`02_run_get_gemini_api_key.bat`** を実行した場合は、続けて **`03_start_servers_and_agent.bat`** が実行されるので、このステップの作業は不要です。

- 一度でも、**STEP 3: 【最重要かつ最初】APIキーの設定**　**STEP 4: Gemini APIキーの設定**　を実行したら、
その次からは、**STEP 5: MCP サーバーと Mastra Agent の起動**のみを実行して、サーバーを起動します。
- **サーバーを停止する際は必ず、MCP サーバーと Mastra Agent のコンソールウィンドウ（黒い窓３個）を閉じてください。**

展開したフォルダのルートディレクトリにある **`03_start_servers_and_agent.bat`** をダブルクリックして実行してください。このバッチファイルが、必要な Node.js プロジェクトのセットアップ（依存インストール、ビルド）および各 MCP サーバーと Mastra Agent の起動を自動化します。

1.  展開したフォルダのルートディレクトリにある **`03_start_servers_and_agent.bat` をダブルクリックして実行します。**
2.  コンソールウィンドウが開き、必要な依存パッケージのインストール（初回のみ時間がかかります）、TypeScriptのビルド、そして各 MCP サーバーの起動が順次実行されます。
3.  **MCP サーバー (`crs-mcp-scraper-server` および `crs-mcp-law-server`) および、少し遅れて起動した Mastra Agent は、それぞれ別のコンソールウィンドウとして起動したままになります。** これらのウィンドウは、サーバーが動作している間は **閉じないでください**。サーバーが正常に起動すると、それぞれのウィンドウに「Listening for POST requests on http://localhost:.../mcp」のようなメッセージが表示されているはずです。Mastra Agent のコンソールには、起動ログの後にユーザー入力待ちを示すプロンプトが表示されるはずです（または、Web UI が開く場合はブラウザが表示されます）。

4.  バッチファイルの実行が完了すると、Mastra Agent (またはその Web UI) との対話に進む準備が整います。


### **STEP 6: Mastra Agent との対話**

MCPサーバーと Mastra Agent が起動したら、Mastra Agent を通じて LLM に指示を出し、ブラウザ操作ツールを利用できます。

Mastra Agent は Web UI を提供します。`02_start_servers_and_agent.bat` の実行により、ブラウザが自動的に起動し、Mastra Agent の Web UI が表示されます。（デフォルト URL: `http://localhost:4111/`）。

1.  **Web ブラウザを開き、`http://localhost:4111/` にアクセスします。** (`02_start_servers_and_agent.bat` で自動的に開きます。)
2.  Mastra Agent の Web UI が表示されます。ここで、LLM に指示を入力できます。
3.  **LLM に話しかけるように、日本語で指示を入力してください。** Agent はあなたの指示を理解し、必要に応じて MCP サーバー上のツール（内部的に `.exe` ファイルを実行）を呼び出して応答します。

* **3-1** エージェントWeb Scraper Agentを選択した場合は以下のように指示します。
    - 指示を出す際は、どの「設定セット (`setdir`)」を使いたいかを明確に伝える必要があります。Agent の Instructions には、LLM が認識すべき `setdir` 名の例が含まれています。
    - 例：「google で 日本の首相 を検索して」 (内部的に `setdir='google--search_query'` を使用)
    - 例：「pmda で パキシル の情報を詳しく教えて」 (内部的に`setdir='pmda--search_query'` を使用)
    - 例：「メルカリでスイッチについて検索して」 (内部的に `setdir='merucari--search_query'` を使用)
    - `setdir` の名前は、`crs-mcp-scraper-server\bin\` のサブディレクトリ名に対応します。これらのディレクトリ内に格納されている `playwright_steps_logic.py` が具体的な操作手順を、`playwright_steps_param.txt` がパラメータを定義しています。

* **3-2** エージェントLaw Analyzer Agentを選択した場合は以下のように指示します。    
    - 指示を出す際は、どの「設定セット (`setdir`)」を使いたいかを明確に伝える必要があります。Agent の Instructions には、LLM が認識すべき `setdir` 名の例が含まれています。
    - 例：「建築基準法で階段について調べて、関連条文を全部教えて」 (内部的に `setdir='kenchiku-kijunhou'` を使用)
    - `setdir` の名前は、`crs-mcp-law-server\bin\` のサブディレクトリ名に対応します。これらのディレクトリ内に格納されている `playwright_steps_logic.py` が具体的な操作手順を、`playwright_steps_param.txt` がパラメータを定義しています。

4.  対話を終了したい場合は、MCP サーバーと Mastra Agent のコンソールウィンドウ（黒い窓３個）を閉じてください。

## その他のツール

### `chrome-recorder.exe` (操作記録ツール)

*   **役割**: Playwright 操作手順の記録と生成。カスタムの Web 操作手順を作成したり、既存の手順を修正したりしたい場合に利用します。
*   **実行タイミング**: 新しい Web 操作手順を作成したい場合や、既存の手順がサイトの変更などで動かなくなった場合に必要に応じて実行します。**通常の使用では実行不要です。**
*   **保存場所**: 展開したフォルダのルートディレクトリにあります。
*   **使い方**: コマンドプロンプトや PowerShell から実行します。
    ```cmd
    cd path\to\your\mastra-crs-mcp\
    chrome-recorder.exe <記録を開始したいウェブサイトのURL> [--no-stealth]
    ```
    *   引数で、記録を開始したいウェブサイトの URL を指定して起動します。
    *   ブラウザと Playwright Inspector が表示されたら、Inspector で左上の RECORD ボタンをクリックし、記録を開始し、ブラウザで目的の操作を行います。
    *   Inspector に生成される Python コードと、操作対象となった要素のセレクタ情報をコピーします。
    *   コピーしたコードとセレクタ情報を、**`crs-mcp-scraper-server\bin\` または `crs-mcp-law-server\bin\`** ディレクトリ内に、新しい `setdir` フォルダを作成しその内側に `playwright_steps_logic.py` および `playwright_steps_param.txt` ファイルを作成/更新するために使用します。詳しい編集方法は、README の「新しい Web 操作手順の作成」セクションを参照してください。

### `chrome-auto-scraper.exe`

*   **役割**: 汎用的な Web スクレイピングタスクを実行。
*   **実行タイミング**: `crs-mcp-scraper-server` から `chromeRecScraper_run_scraper` ツールが呼び出された際に、サーバーによって実行されます。**ユーザーが直接コマンドラインから実行する必要は通常ありません。**
*   **保存場所**: `crs-mcp-scraper-server\bin\` ディレクトリ内にあります。
*   **コマンドライン引数 (MCPサーバーが自動で渡します)**:
    *   `--setdir <ディレクトリ名>`: 必須。操作手順 (`playwright_steps_logic.py`) とパラメータ (`playwright_steps_param.txt`) が格納された `./bin` 内のサブディレクトリ名。
    *   `--search_query <検索語句>`: オプション。`playwright_steps_logic.py` 内の `{{search_query}}` プレースホルダーに渡す値。
*   **出力**: 標準出力に JSON 形式で抽出結果を出力します。

### `chrome-law-analyzer.exe`

*   **役割**: e-Gov 法令 HTML から指定キーワードの関連情報を抽出。
*   **実行タイミング**: `crs-mcp-law-server` から `LawAnalyzer_run_law_analyzer` ツールが呼び出された際に、サーバーによって実行されます。**ユーザーが直接コマンドラインから実行する必要は通常ありません。**
*   **保存場所**: `crs-mcp-law-server\bin\` ディレクトリ内にあります。
*   **コマンドライン引数 (MCPサーバーが自動で渡します)**:
    *   `--setdir <ディレクトリ名>`: 必須。対象法令の設定ディレクトリ名 (例: `law`, `kenchiku-kijunhou`)。これは `crs-mcp-law-server\bin\` 内のサブディレクトリ名に対応します。
    *   `--law-search-keyword <キーワード>`: 必須。法令 HTML 内で検索するキーワード。
*   **出力**: 標準出力に JSON 形式（またはキーワードが見つからなかったことを示す文字列）で抽出結果を出力します。

## 新しい Web 操作手順の作成

カスタムの Web 操作手順（例：特定のECサイトの商品ページから情報を取得する、業務システムの定型操作を行うなど）を作成したい場合は、ルートディレクトリにある `chrome-recorder.exe` と、`crs-mcp-scraper-server\bin\` または `crs-mcp-law-server\bin\` ディレクトリ内の設定ファイルを使用します。

1.  **対象サイトの `setdir` フォルダを作成**: **`crs-mcp-scraper-server\bin\` ディレクトリ内**に、新しいスクレイピングタスク用のサブディレクトリを分かりやすい名前（例: `my-new-site--data_extraction`）で作成します。この名前が Agent に指示する際の `setdir` 名になります。**法令解析用タスクの場合は、`crs-mcp-law-server\bin\` ディレクトリ内**に作成します。
2.  **`chrome-recorder.exe` で操作を記録**: 展開したフォルダのルートディレクトリでコマンドプロンプトを開き、`chrome-recorder.exe` を実行します。記録を開始したいウェブサイトの URL を引数で指定してください。
    ```cmd
    cd path\to\your\mastra-crs-mcp\
    chrome-recorder.exe https://example.com/start_page [--no-stealth]
    ```
3.  **Inspector で操作を記録**: 起動したブラウザで目的の操作（クリック、入力、ナビゲーションなど）を実際に行います。Inspector ウィンドウに Playwright コードが生成されます。また、データを抽出したい要素や、リンクを辿りたい場合のリンク要素のセレクタなども Inspector で確認・コピーしておきます。
4.  **`playwright_steps_logic.py` を作成**: 作成した `setdir` フォルダ内に `playwright_steps_logic.py` という名前でファイルを作成します。以下の基本構造の中に、Inspector からコピーした操作コードを貼り付けます。
    ```python
    import re
    from playwright.sync_api import Playwright, sync_playwright, expect

    def run(playwright: Playwright) -> None:
        # Playwright Inspectorからコピーした操作コードをここに貼り付けます。
        # Inspectorが生成するブラウザの起動・終了に関するコード（browser = ..., context = ..., page = ..., context.close(), browser.close() など）や、
        # 末尾の with sync_playwright(): run(playwright) ブロックは削除してください。
        # page.goto("...") から始まる具体的な操作コードのみを貼り付けます。

        # 例：
        # page.goto("https://example.com/start_page")
        # page.locator("#search_input").fill("keyword")
        # page.locator("#search_button").click()
        # ... 続く操作 ...

        pass # 必要に応じて操作コードの最後に pass を残すか、削除

    # sync_playwright の実行ブロックは削除してください。
    ```
    もし、Agent から検索語句などのパラメータを渡したい場合は、記録後のコードを編集し、`page.fill("セレクタ", "{{変数名}}")` のように `{{変数名}}` 形式のプレースホルダーを手動で追加してください。
5.  **`playwright_steps_param.txt` を作成**: 作成した `setdir` フォルダ内に `playwright_steps_param.txt` という名前でファイルを作成します。このファイルに、その操作手順で使うパラメータを記述します。これは `chrome-auto-scraper.exe` または `chrome-law-analyzer.exe` の挙動を制御する重要な設定です。
    ```txt
    # playwright_steps_param.txt for my-new-site--data_extraction

    --headless False # Chromeを見える状態で実行 (開発・デバッグ時)
    # --headless True # Chromeを見えない状態で実行 (本番実行時)

    --slow-mo 100 # 各 Playwright 操作間に 100 ミリ秒の遅延を入れる (オプション: サイトへの負荷軽減や、人間らしい操作の再現に役立つ)

    # --- データ抽出設定 ---
    # 以下のいずれかのモードと、それに付随する設定を記述します。

    # 例1: ページ全体のテキストを抽出する場合 (chrome-auto-scraper.exe 用)
    --extract body
    --extract-target body # この行は必須ではないが明示的にbodyを指定

    # 例2: リンクを辿ってリンク先からデータを抽出する場合 (chrome-auto-scraper.exe 用)
    --extract loop-links
    --link-selector .product-link # 必須：辿りたいリンク要素のCSSセレクタ
    --extract-target body # 必須：リンク先で抽出したいターゲット (body, title, h1, h2, link_text など)
    # --target-index 0 # オプション：loop-links モードで、見つかったリンクのうち最初の1件(0)のみ処理する場合。省略または-1で全て処理。
    # --item-selector .product-name # extract-target が selector の場合に必須

    # 例3: 現在のページで、特定のセレクタに一致する要素のテキストをリストで抽出する場合 (chrome-auto-scraper.exe 用)
    # --extract selector
    # --item-selector .product-price # 必須：抽出したい個々の要素のCSSセレクタ
    # --extract-target body # このモードでは extract-target は通常無視されますが、指定しても良い

    # 例4: e-Gov 法令解析用 (chrome-law-analyzer.exe 用)
    # --law-search-keyword 階段 # オプション：デフォルトの検索キーワード（Agentからの指示が優先される）
    # extract/extract-target は Law Analyzer では固定のため不要 (body が前提)
    ```
    利用可能なパラメータとその意味は、同梱されている既存の `playwright_steps_param.txt` ファイルや、`lib/config.py` の `load_parameters` 関数のコードを参照してください。特に `chrome-law-analyzer.exe` の場合は `playwright_steps_logic.py` の中でアクセスする法令のURLを指定し、`playwright_steps_param.txt` では `--law-search-keyword` などを設定します。
6.  **Mastra Agent の Instructions の更新 (推奨)**: 新しい `setdir` を作成した場合、Mastra Agent がユーザーの指示からその設定名を認識し、対応するツール呼び出しを生成できるように、Mastra Agent の Instructions を更新することを検討してください。Agent の Instructions (例: `mastra/src/mastra/agents/scraperAgent.ts`, `mastra/src/mastra/agents/lawAnalyzerAgent.ts`) をテキストエディタで開き、「考えられる 'setdir' の値の例」リストや、ツールの使い方説明に、新しく追加した `setdir` 名とその用途を追記します。Instructions を編集したら、Mastra Agent アプリケーションを再度ビルド＆起動 (`cd mastra && npm run dev`) し、してください。

## トラブルシューティング

*   **Node.js や npm に関するエラー**: Node.js と npm が正しくインストールされ、環境変数 PATH が設定されているか確認してください (STEP 1)。
*   **アプリケーションファイルの展開エラー**: ファイルが破損していないか、展開先のフォルダ名に問題がないか確認してください (STEP 2)。
*   **`01_run_get_api_key.exe` の実行時にエラーが出る**: STEP 3 の手順と注意点を確認してください。インターネット接続、Google アカウント認証、エラーメッセージの内容などを確認し、必要に応じて再実行してください。
*   **`02_start_servers_and_agent.bat` がエラーで停止する**: Node.js プロジェクトの依存インストールやビルドに失敗している可能性があります。バッチファイルを実行したコンソールに表示されるエラーメッセージを確認してください。ポート衝突の可能性もあります。必要であれば、サーバーの `src/server.ts` ファイル内でポート番号を変更し、バッチを再実行してください。
*   **MCP サーバーが起動しない（`02_start_servers_and_agent.bat` 実行後、対応するコンソールウィンドウにエラーが表示される）**: サーバーが起動しているはずのコンソールウィンドウに表示されるエラーメッセージを確認してください。ポート衝突、EXEファイルが見つからない（サーバー側のパス指定ミスなど）、権限エラーなどが考えられます。
*   **Mastra Agent に指示を出してもブラウザが開かない、応答がない、またはエラーになる**:
    *   **【最も可能性が高い原因】API キーが正しく設定されていない、または期限切れ/無効になっている。** STEP 3 に戻り、`01_run_get_api_key.exe` を実行して API キーを再設定してください。
    *   MCP サーバーのコンソールウィンドウに、内部で呼び出された `.exe` ファイルの実行に関するエラー（パスが見つからない、権限エラー、exe 実行時のエラーなど）が表示されていないか確認してください。
    *   exe の実行ログ（通常は MCP サーバーのコンソールに出力される `-- STDOUT --` や `-- STDERR --` のブロック、または `Critical Error` のメッセージ）を確認してください。
    *   Agent に指示した `setdir` 名が正しいか確認してください。
    *   使用している `setdir` の `playwright_steps_logic.py` に記述された Playwright ステップが無効になっている（サイトの変更などによる要素セレクタの変更、操作手順の変更など）可能性があります。その場合は、`chrome-recorder.exe` を使用して新しい手順を記録し直し、該当する設定ファイルを更新してください。
*   **`chrome-recorder.exe` がブラウザを起動しない**:
    *   お使いのシステムに Chrome ブラウザがインストールされているか確認してください。
    *   同梱されている Playwright 実行ファイルは、特定の Chrome インストールパスを想定している場合があります。もしエラーが表示される場合は、Playwright を手動でインストールし直す必要があるかもしれません (`playwright install chromium` を実行してみてください)。
    *   セキュリティソフトによって実行がブロックされていないか確認してください。

---

## ライセンス

*   本プロジェクトの Node.js コード (MCP サーバー、Mastra Agent など) および Playwright 操作手順ファイル (`playwright_steps_logic.py`, `playwright_steps_param.txt`)、並びに付随する Python ライブラリコード (`lib/` フォルダ内) は、指定されたオープンソースライセンス（各 `package.json` または該当ファイル内に記載）の下で提供されます。
*   **同梱されている実行可能ファイル (`.exe` ファイル群 - `01_run_get_api_key.exe`, `chrome-recorder.exe`, `chrome-auto-scraper.exe`, `chrome-law-analyzer.exe`) はクローズドソースであり、再頒布、逆コンパイル、改変などは許可されません。** これらのファイルは本アプリケーションの利用目的のためにのみ提供されます。
*   EXEファイルの利用には、認証および利用制限が伴います。詳細は API キー設定のセクションをご確認ください。
