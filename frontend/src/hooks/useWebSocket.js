import { useRef, useCallback, useState } from 'react';

const API_BASE = 'ws://localhost:3002';

export default function useWebSocket() {
  const wsRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback((convoId, message, kbIds = [], systemPrompt = null, onToken, onDone, onError) => {
    setIsStreaming(true);

    const ws = new WebSocket(`${API_BASE}/api/chat/ws/${convoId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        message,
        kb_ids: kbIds,
        system_prompt: systemPrompt,
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'token') {
        onToken(data.content);
      } else if (data.type === 'done') {
        setIsStreaming(false);
        ws.close();
        if (onDone) onDone();
      } else if (data.type === 'error') {
        setIsStreaming(false);
        ws.close();
        if (onError) onError(data.content);
      }
    };

    ws.onerror = () => {
      setIsStreaming(false);
      if (onError) onError('WebSocket connection failed');
    };

    ws.onclose = () => {
      setIsStreaming(false);
    };
  }, []);

  const stopStreaming = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  return { sendMessage, stopStreaming, isStreaming };
}
