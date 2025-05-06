import os
import pathspec  # pathspec をインポート
import sys       # sysモジュールをインポート

# --- 定数定義 ---
# PEP 8では定数は大文字スネークケースが推奨される
DEFAULT_OUTPUT_FILE = "code_output.txt"
TARGET_EXTENSIONS = [
    ".py", ".js", ".html", ".md", ".json", ".ts", ".txt", ".exe"
]
# 内容を読み込まない（バイナリとして扱う）拡張子のリスト
BINARY_EXTENSIONS = [
    ".exe", ".dll", ".so", ".png", ".jpg", ".jpeg", ".gif", ".bmp",
    ".zip", ".gz", ".tar", ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".ppt", ".pptx", ".o", ".a", ".lib", ".obj", ".pdb", ".bin",
    ".img", ".iso", ".dat", ".pyd", ".pyc"
    # 必要に応じて他のバイナリ拡張子を追加
]
# ハードコードされた除外パターン (gitignore形式)
HARDCODED_EXCLUDE_PATTERNS = [
    "venv*",         # venv, venv312 などにマッチ
    ".git/",
    ".vscode/",
    "output/",
    DEFAULT_OUTPUT_FILE, # 出力ファイル自体を除外
    "codeA.py",      # 特定のファイルを除外
    "codeB.py",      # 特定のファイルを除外
    "__pycache__/",
    "node_modules/", # 一般的な除外パターン
    "dist/",
    ".env",
    "*.log",
    "*.pyc",
    "*.o",
    "*.a",
    "*.so",
    "*.lib",
    "*.obj",
    "*.pdb",
]

# --- 関数定義 ---

def read_gitignore(gitignore_path=".gitignore"):
    """
    .gitignore ファイルからパターンを読み込みます。
    空行とコメント (# で始まる行) を除外します。

    Args:
        gitignore_path (str): .gitignoreファイルのパス。

    Returns:
        list[str]: 除外パターンのリスト。ファイルが存在しない場合は空リスト。
    """
    patterns = []
    try:
        with open(gitignore_path, "r", encoding="utf-8") as f:
            # リスト内包表記で効率的に処理
            patterns = [
                line.strip() for line in f
                if line.strip() and not line.startswith("#")
            ]
    except FileNotFoundError:
        # ファイルが見つからない場合は警告を表示し、処理を続ける
        print(
            f"警告: gitignoreファイル '{gitignore_path}' が見つかりません。",
            file=sys.stderr
        )
        # pass文は不要 (ブロックが空でも問題ない)
    except OSError as e:
        # ファイル読み込みに関する他のOSエラー
        print(
            f"エラー: gitignoreファイル '{gitignore_path}' の読み込み中に"
            f"OSエラーが発生しました: {e}",
            file=sys.stderr
        )
    except Exception as e:
        # その他の予期せぬエラー
        print(
            f"エラー: gitignoreファイル '{gitignore_path}' の読み込み中に"
            f"予期せぬエラーが発生しました: {e}",
            file=sys.stderr
        )
    return patterns


def process_file(filepath, output_file, read_content=True):
    """
    指定されたファイルの情報（内容を含むか含まないか選択可能）を
    指定されたフォーマットで出力ファイルに書き込みます。

    Args:
        filepath (str): 処理対象のファイルの絶対パスまたは相対パス。
        output_file (str): 出力先のファイルパス。
        read_content (bool): Trueの場合、ファイル内容を読み込んで出力する。
                             Falseの場合、内容は省略する。
    """
    try:
        # ファイルパスからルートディレクトリとファイル名を分離
        root, file = os.path.split(filepath)
        # ルートが空文字列の場合（カレントディレクトリのファイル）、'.' を設定
        if not root:
            root = '.'

        content = None
        content_message = "- 内容:\n" # デフォルトの内容ヘッダー

        # read_content が True の場合のみファイル内容を試行的に読み込む
        if read_content:
            try:
                # UTF-8でファイルを開く
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
            except UnicodeDecodeError:
                # UTF-8でデコードできないバイナリファイルなどの場合
                print(
                    f"警告: '{filepath}' はUTF-8でデコードできませんでした。"
                    "内容は省略します。",
                    file=sys.stderr
                )
                read_content = False  # 内容は読み込めなかったのでフラグをFalseに
                content_message = "- 内容: (バイナリファイルまたはデコードエラーのため省略)\n"
            except OSError as e:
                # ファイル読み込みに関する他のOSエラー (アクセス権限など)
                print(
                    f"エラー: '{filepath}' の内容読み込み中にOSエラーが"
                    f"発生しました: {e}",
                    file=sys.stderr
                )
                read_content = False
                content_message = f"- 内容: (読み込みエラーのため省略: {e})\n"
            except Exception as e:
                # その他の予期せぬ読み込みエラー
                print(
                    f"エラー: '{filepath}' の内容読み込み中に予期せぬエラーが"
                    f"発生しました: {e}",
                    file=sys.stderr
                )
                read_content = False
                content_message = f"- 内容: (予期せぬ読み込みエラーのため省略: {e})\n"
        else:
            # 最初から内容を読み込まない場合
            content_message = "- 内容: (指定により省略)\n"

        # --- 出力ファイルへの書き込み ---
        try:
            with open(output_file, "a", encoding="utf-8") as outfile:
                # パス区切り文字を POSIX スタイル ('/') に統一して出力
                posix_root = root.replace(os.sep, '/')

                # ファイル情報の書き込み
                outfile.write("\n\n\n---\n\n\n")
                outfile.write(f"- フォルダ名: {posix_root}\n")
                outfile.write(f"- ファイル名: {file}\n")
                outfile.write(content_message) # 内容ヘッダーまたは省略メッセージ

                # 内容が存在し、読み込みが成功した場合のみ内容を書き込む
                if read_content and content is not None:
                    outfile.write(content)

        except OSError as e:
            # 出力ファイルへの書き込みエラー
            print(
                f"エラー: 出力ファイル '{output_file}' への書き込み中に"
                f"OSエラーが発生しました: {e}",
                file=sys.stderr
            )
        except Exception as e:
            # その他の予期せぬ書き込みエラー
            print(
                f"エラー: 出力ファイル '{output_file}' への書き込み中に"
                f"予期せぬエラーが発生しました: {e}",
                file=sys.stderr
            )

    except Exception as e:
        # ファイルパスの処理や予期せぬエラー
        print(
            f"エラー: ファイル '{filepath}' の処理中に予期せぬエラーが"
            f"発生しました: {e}",
            file=sys.stderr
        )


def main():
    """
    メイン処理関数。
    カレントディレクトリ以下を探索し、指定された拡張子を持ち、
    .gitignore とハードコードされたパターンで除外されていないファイルの
    情報を出力ファイルに書き込みます。
    """
    output_file = DEFAULT_OUTPUT_FILE

    # --- 除外パターンの準備 ---
    gitignore_patterns = read_gitignore(".gitignore")
    # ハードコードされたパターンとgitignoreのパターンを結合
    all_exclude_patterns = HARDCODED_EXCLUDE_PATTERNS + gitignore_patterns

    # pathspec オブジェクトを作成 (GitWildMatchPattern を使用)
    # これが .gitignore のルールを解釈する
    try:
        spec = pathspec.PathSpec.from_lines(
            pathspec.patterns.GitWildMatchPattern, all_exclude_patterns
        )
    except Exception as e:
        print(
            f"エラー: pathspec の初期化中にエラーが発生しました: {e}\n"
            "除外パターンが正しくない可能性があります。",
            file=sys.stderr
        )
        # spec がないと処理を続けられないので終了する
        sys.exit(1)

    # --- 出力ファイルの初期化 ---
    try:
        # 出力ファイルが既に存在すれば削除 (追記ではなく毎回新規作成)
        if os.path.exists(output_file):
            os.remove(output_file)
    except OSError as e:
        print(
            f"エラー: 既存の出力ファイル '{output_file}' の削除中に"
            f"OSエラーが発生しました: {e}",
            file=sys.stderr
        )
        # 削除できなくても処理は続けられる場合があるが、警告は出す
    except Exception as e:
        print(
            f"エラー: 既存の出力ファイル '{output_file}' の削除中に"
            f"予期せぬエラーが発生しました: {e}",
            file=sys.stderr
        )

    # --- 処理結果記録用のリスト ---
    processed_files_content = []  # 内容を含めて処理されたファイル
    processed_files_no_content = [] # 内容を省略して処理されたファイル
    excluded_files_spec = []       # 除外パターンによって除外されたファイル
    excluded_files_extension = []  # 対象外の拡張子によって除外されたファイル

    # --- ファイルシステムの探索と処理 ---
    print("ファイル探索と処理を開始します...")
    try:
        # os.walk でカレントディレクトリ (.) 以下を再帰的に探索
        # topdown=True はデフォルトだが明示
        for root, dirs, files in os.walk(".", topdown=True):

            # --- ディレクトリの除外 (オプション: パフォーマンス向上) ---
            # .gitignore パターンにマッチするディレクトリを探索対象から除外する
            # イテレーション中にリストを変更するため、スライス(dirs[:])を使用
            dirs[:] = [
                d for d in dirs
                if not spec.match_file(
                    os.path.relpath(os.path.join(root, d), ".").replace(os.sep, '/') + '/'
                )
            ]
            # メモ: 除外されたディレクトリ自体は excluded_files_spec には記録されない
            # 必要であればここで記録するロジックを追加できる

            # --- ファイルの処理 ---
            for file in files:
                # 絶対パスを取得 (エラーメッセージなどで分かりやすいため)
                filepath_abs = os.path.join(root, file)
                # pathspec で判定するために、カレントディレクトリからの相対パスに変換し、
                # 区切り文字を '/' に統一する (Git スタイル)
                try:
                    filepath_rel_posix = os.path.relpath(filepath_abs, ".").replace(os.sep, '/')
                except ValueError as e:
                    # パスがおかしい場合など
                    print(
                        f"警告: 相対パスの取得に失敗しました: {filepath_abs} ({e})。"
                        "このファイルはスキップされます。",
                        file=sys.stderr
                    )
                    continue # 次のファイルへ

                # 1. 除外パターンによる判定 (pathspec)
                if spec.match_file(filepath_rel_posix):
                    excluded_files_spec.append(filepath_rel_posix)
                    # print(f"除外 (パターン): {filepath_rel_posix}") # 詳細ログ用
                    continue  # 除外パターンに一致したら次のファイルへ

                # 2. 拡張子による判定
                file_lower = file.lower() # 比較は小文字で行う
                is_target_extension = False
                for ext in TARGET_EXTENSIONS:
                    if file_lower.endswith(ext):
                        is_target_extension = True
                        break # 対象拡張子のいずれかに一致したらループ終了

                if is_target_extension:
                    # 対象拡張子の場合、バイナリ拡張子かどうかを判定
                    should_read_content = True # デフォルトは内容を読む
                    for bin_ext in BINARY_EXTENSIONS:
                        if file_lower.endswith(bin_ext):
                            should_read_content = False
                            break # バイナリ拡張子に一致したらループ終了

                    # ファイル処理関数を呼び出し
                    process_file(filepath_abs, output_file, read_content=should_read_content)

                    # 処理結果をリストに追加
                    if should_read_content:
                        processed_files_content.append(filepath_rel_posix)
                        # print(f"処理 (内容あり): {filepath_rel_posix}") # 詳細ログ用
                    else:
                        processed_files_no_content.append(filepath_rel_posix)
                        # print(f"処理 (内容省略): {filepath_rel_posix}") # 詳細ログ用
                else:
                    # 対象拡張子でない場合
                    excluded_files_extension.append(filepath_rel_posix)
                    # print(f"除外 (拡張子): {filepath_rel_posix}") # 詳細ログ用

    except Exception as e:
        print(
            f"\nエラー: ファイル探索または処理中に予期せぬエラーが発生しました: {e}",
            file=sys.stderr
        )
        # エラーが発生しても、ここまでの結果は表示する

    # --- 処理結果のサマリー表示 ---
    print("\n--- 処理完了 ---")
    print(
        f"\n除外されたファイル (gitignore/パターン) "
        f"({len(excluded_files_spec)} 件):"
    )
    for f in sorted(excluded_files_spec):
        print(f"除外:gitignore- {f}")

    print(
        f"\n除外されたファイル (対象外拡張子) "
        f"({len(excluded_files_extension)} 件):"
    )
    for f in sorted(excluded_files_extension):
        print(f"除外:対象外拡張子- {f}")

    print(f"\n\n出力ファイル: {output_file}")

    print(
        f"\n処理されたファイル (内容省略/バイナリ等) "
        f"({len(processed_files_no_content)} 件):"
    )
    for f in sorted(processed_files_no_content):
        print(f"処理済bin- {f}") # こちらは件数が少ない可能性があるので表示

    print(
        f"\n処理されたファイル (内容あり) "
        f"({len(processed_files_content)} 件):"
    )
    for f in sorted(processed_files_content):
        print(f"処理済- {f}")



    print("\nスクリプトの実行が終了しました。")


# スクリプトとして実行された場合に main() 関数を呼び出す
if __name__ == "__main__":
    main()