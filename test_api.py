# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx"]
# ///
import httpx
import sys

# 配置
BASE_URL = "https://api.zolin.cc"  # 修改为你的域名
API_KEY = "sk-relay-sORNknDE9c87zuy-wSqhJCnN0Jihkj3s"  # 修改为你的 API Key

def test_chat():
    """测试 chat completions API"""
    url = f"{BASE_URL}/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    
    payload = {
        "model": "nano",  # nano, base, pro
        "messages": [
            {"role": "user", "content": "Hello! Say hi in one word."}
        ],
        "stream": False,
    }
    
    print(f"请求: POST {url}")
    print(f"Model: {payload['model']}")
    print("-" * 40)
    
    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(url, headers=headers, json=payload)
            
            print(f"状态码: {response.status_code}")
            print("-" * 40)
            
            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                print(f"回复: {content}")
            else:
                print(f"错误: {response.text}")
                
    except httpx.ConnectError:
        print("错误: 无法连接服务器，请确保服务已启动")
    except Exception as e:
        print(f"错误: {e}")

def test_stream():
    """测试流式响应"""
    url = f"{BASE_URL}/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    
    payload = {
        "model": "nano",
        "messages": [
            {"role": "user", "content": "Count from 1 to 5."}
        ],
        "stream": True,
    }
    
    print(f"请求 (流式): POST {url}")
    print("-" * 40)
    
    try:
        with httpx.Client(timeout=60.0) as client:
            with client.stream("POST", url, headers=headers, json=payload) as response:
                print(f"状态码: {response.status_code}")
                print("回复: ", end="", flush=True)
                
                for line in response.iter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        import json
                        chunk = json.loads(data)
                        if chunk["choices"][0].get("delta", {}).get("content"):
                            print(chunk["choices"][0]["delta"]["content"], end="", flush=True)
                print()
                
    except httpx.ConnectError:
        print("错误: 无法连接服务器")
    except Exception as e:
        print(f"错误: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--stream":
        test_stream()
    else:
        test_chat()
        print()
        print("提示: 使用 --stream 参数测试流式响应")
