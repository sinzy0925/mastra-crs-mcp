import requests
import json
import os
import time # time モジュールをインポート

# MCPサーバーのURL (ローカルテスト用に直接指定、Dify上では環境変数や入力変数から取得)
# Difyのコードブロック内で実行する場合は、この行はコメントアウトし、
# os.environ.get または inputs から取得するロジックを生かします。
# 今回はローカル実行のテストを想定しているため、ここで直接定義します。
mcp_server_url = "https://mcp-server.veryglad.win/mcp" # または http://localhost:3001/mcp (トンネルなしの場合)

# --- Dify コードブロックの入力変数を模倣 ---
# Dify のコードブロックでは、'inputs' は事前に定義された辞書として渡される
# ローカルでテスト実行するために、ここで辞書として初期化する
inputs: dict[str, str] = {} # ★★★ 空の辞書として初期化 ★★★
inputs['setdir'] = 'google--search_query'
inputs['search_query'] = 'google'
# inputs['mcp_server_url_from_input'] = "https://mcp-server.veryglad.win/mcp" # もし入力変数でURLを渡す場合

# ---

def main() -> dict: # Dify のコードブロックは通常、辞書を return する
    global mcp_server_url # グローバル変数を参照することを明示 (ローカルテスト用)

    # Difyの環境変数からURLを取得する場合 (Difyプラットフォーム上での実行時)
    # このローカルテストでは上の mcp_server_url を使う
    # if 'DIFY_ENVIRONMENT' in os.environ: # Dify環境かどうかを判定する何らかの方法 (これは一例)
    #     env_mcp_server_url = os.environ.get('MY_MCP_SERVER_URL')
    #     if env_mcp_server_url:
    #         mcp_server_url = env_mcp_server_url
    #     elif inputs.get('mcp_server_url_from_input'): # 入力変数からも試す
    #          mcp_server_url = inputs.get('mcp_server_url_from_input')

    print(f"Using MCP Server URL: {mcp_server_url}")
    if not mcp_server_url:
        print("Error: MCP_SERVER_URL is not defined.")
        return {"error": "MCP_SERVER_URL is not defined."}

    # Difyの入力変数からツール呼び出しの引数を取得
    setdir: Optional[str] = inputs.get("setdir")
    search_query: Optional[str] = inputs.get("search_query")

    print(f"Received setdir: {setdir}, search_query: {search_query}")

    if not setdir: # isinstance チェックも加えるとより堅牢
        print("Error: 'setdir' input is missing or invalid.")
        return {"error": "'setdir' input is missing or invalid."}

    mcp_tool_name = "run_scraper"
    mcp_tool_args = {
        "setdir": setdir
    }
    if search_query: # isinstance チェックも加えるとより堅牢
        mcp_tool_args["search_query"] = search_query

    request_id = "dify-python-script-call-" + str(time.time())
    jsonrpc_request_body = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": mcp_tool_name,
            "arguments": mcp_tool_args
        },
        "id": request_id
    }
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
    }

    print(f"Sending POST request to {mcp_server_url}")
    print(f"Request Body: {json.dumps(jsonrpc_request_body)}") # デバッグ用にボディ全体を表示

    try:
        response = requests.post(
            mcp_server_url,
            json=jsonrpc_request_body,
            headers=headers,
            timeout=310.0
        )
        response.raise_for_status()
        response.encoding = 'utf-8'

        print(f"Response status: {response.status_code}")
        print(f"Response headers: {response.headers}")
        
        response_text = response.text
        print(f"Raw response text (first 500 chars): {response_text[:500]}...")
        
        sse_data_payload = ""
        # MCPサーバーはContent-Type: text/event-streamで応答し、
        # 実際のデータは "data: <JSON文字列>" の形式で送られてくる。
        # tools/call の場合、通常は1つの data イベントで完結する。
        for line in response_text.splitlines():
            if line.startswith("data:"):
                sse_data_payload = line[len("data:"):].strip()
                print(f"Extracted SSE data payload: {sse_data_payload[:200]}...")
                break 
                
        if not sse_data_payload:
            print("Error: No 'data:' line found in SSE response.")
            return {"error": "No 'data:' line found in SSE response."}

        try:
            response_data_json = json.loads(sse_data_payload)
            print(f"Parsed data from SSE: {json.dumps(response_data_json, indent=2)}") # 整形して表示

            if "error" in response_data_json and response_data_json["error"]:
                error_detail = response_data_json["error"]
                error_message = error_detail.get('message', 'Unknown MCP server error')
                print(f"MCP Server returned an error: {error_message}")
                return {"error": f"MCP Server Error: {error_message}"}
            elif "result" in response_data_json and response_data_json.get("id") == request_id:
                result_data = response_data_json["result"]
                if result_data.get("isError"):
                    content_list = result_data.get("content", [])
                    error_text = "MCP Tool Error (no specific message)"
                    if content_list and content_list[0].get("type") == "text":
                        error_text = content_list[0].get("text", error_text)
                    print(f"MCP Tool execution failed: {error_text}")
                    return {"error": error_text}
                else:
                    content_list = result_data.get("content", [])
                    result_text = ""
                    if content_list and content_list[0].get("type") == "text":
                        result_text = content_list[0].get("text", "")
                    print(f"MCP Tool execution successful. Result text (first 200 chars): {result_text[:200]}...")
                    return {"scraper_result": result_text}
            else:
                print(f"Invalid JSON-RPC response structure: {response_data_json}")
                return {"error": "Invalid JSON-RPC response from MCP server."}
                
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON from SSE data: {e}. Data: '{sse_data_payload}'")
            return {"error": f"Error decoding JSON from SSE: {e}"}

    except requests.exceptions.Timeout:
        print(f"Request to {mcp_server_url} timed out.")
        return {"error": "Request to MCP server timed out."}
    except requests.exceptions.RequestException as e:
        print(f"Request to {mcp_server_url} failed: {e}")
        return {"error": f"Request to MCP server failed: {type(e).__name__} - {e}"}
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return {"error": f"An unexpected error occurred: {type(e).__name__} - {e}"}

if __name__ == "__main__":
    result = main()
    print("\n--- Final Result ---")
    print(json.dumps(result, indent=2, ensure_ascii=False))