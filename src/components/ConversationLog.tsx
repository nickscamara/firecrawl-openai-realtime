import { useEffect } from 'react';
import { X } from 'react-feather';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';

interface ConversationLogProps {
  items: ItemType[];
  onDeleteItem: (id: string) => void;
}

export const ConversationLog = ({ items, onDeleteItem }: ConversationLogProps) => {
  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll('[data-conversation-content]')
    );
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);

  return (
    <div className="content-block conversation">
      <div className="content-block-title">conversation</div>
      <div className="content-block-body" data-conversation-content>
        {!items.length && `awaiting connection...`}
        {items.map((conversationItem) => {
          return (
            <div className="conversation-item" key={conversationItem.id}>
              <div className={`speaker ${conversationItem.role || ''}`}>
                <div>
                  {(conversationItem.role || conversationItem.type).replaceAll(
                    '_',
                    ' '
                  )}
                </div>
                <div
                  className="close"
                  onClick={() => onDeleteItem(conversationItem.id)}
                >
                  <X />
                </div>
              </div>
              <div className={`speaker-content`}>
                {conversationItem.type === 'function_call_output' && (
                  <div>{conversationItem.formatted.output}</div>
                )}
                {!!conversationItem.formatted.tool && (
                  <div>
                    {conversationItem.formatted.tool.name}(
                    {conversationItem.formatted.tool.arguments})
                  </div>
                )}
                {!conversationItem.formatted.tool &&
                  conversationItem.role === 'user' && (
                    <div>
                      {conversationItem.formatted.transcript ||
                        (conversationItem.formatted.audio?.length
                          ? '(awaiting transcript)'
                          : conversationItem.formatted.text || '(item sent)')}
                    </div>
                  )}
                {!conversationItem.formatted.tool &&
                  conversationItem.role === 'assistant' && (
                    <div>
                      {conversationItem.formatted.transcript ||
                        conversationItem.formatted.text ||
                        '(truncated)'}
                    </div>
                  )}
                {conversationItem.formatted.file && (
                  <audio src={conversationItem.formatted.file.url} controls />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
