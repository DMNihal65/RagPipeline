import { Copy, Check, AlertCircle, CheckCircle2, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';

export default function ChatMessage({ message, onCopy, isCopied }) {
  const isUser = message?.role === 'user';
  const isError = message?.role === 'error';
  const isAssistant = message?.role === 'assistant';

  // Debug: Check message structure
  if (!message) {
    return null;
  }

  // Safely access content
  const content = message?.content || '';

  if (isError) {
    return (
      <div className='flex justify-start'>
        <Card className='max-w-md bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900'>
          <div className='p-4 flex gap-3'>
            <AlertCircle size={18} className='text-red-600 dark:text-red-400 shrink-0 mt-0.5' />
            <div className='text-sm text-red-800 dark:text-red-200'>{content}</div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}>
      <div className={`${isUser ? 'max-w-xs md:max-w-md lg:max-w-lg' : 'max-w-2xl'}`}>
        {isAssistant && (
          <Card className='mb-2 bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-none'>
            <div className='px-4 py-3 flex items-center gap-2'>
              <CheckCircle2 size={16} className='text-slate-700 dark:text-slate-300' />
              <span className='text-xs font-medium text-slate-800 dark:text-slate-200'>
                Answer from your document
              </span>
            </div>
          </Card>
        )}

        <Card
          className={`${
            isUser
              ? 'bg-slate-900 text-white border-0 wrap-break-word'
              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white wrap-break-word'
          } shadow-none`}
        >
          <div className='p-2 min-w-0'>
            {/* Message Content */}
            <div className='prose dark:prose-invert prose-sm max-w-none overflow-hidden'>
              {isUser ? (
                <p className='m-0 whitespace-pre-wrap wrap-break-word'>{content}</p>
              ) : (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => (
                      <p className='mb-3 leading-relaxed last:mb-0 wrap-break-word'>{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className='mb-3 ml-4 space-y-1 last:mb-0'>{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className='mb-3 ml-4 space-y-1 list-decimal last:mb-0'>
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => <li className='ml-2 wrap-break-word'>{children}</li>,
                    code: ({ inline, children }) =>
                      inline ? (
                        <code className='bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded text-sm font-mono wrap-break-word'>
                          {children}
                        </code>
                      ) : (
                        <code className='block bg-slate-200 dark:bg-slate-700 p-3 rounded text-sm font-mono overflow-x-auto mb-3 wrap-break-word'>
                          {children}
                        </code>
                      ),
                    blockquote: ({ children }) => (
                      <blockquote className='border-l-4 border-slate-400 pl-4 italic mb-3 text-slate-700 dark:text-slate-300 wrap-break-word'>
                        {children}
                      </blockquote>
                    ),
                    h1: ({ children }) => (
                      <h1 className='text-xl font-bold mb-2 mt-4 wrap-break-word'>{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className='text-lg font-bold mb-2 mt-3 wrap-break-word'>{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className='font-bold mb-2 mt-2 wrap-break-word'>{children}</h3>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-slate-900 dark:text-slate-200 hover:underline wrap-break-word'
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {content}
                </ReactMarkdown>
              )}
            </div>

            {/* Citations Display */}
            {isAssistant && message?.citations && message.citations.length > 0 && (
              <div className='mt-4 pt-4 border-t border-slate-200 dark:border-slate-700'>
                <div className='flex items-center gap-1.5 mb-3'>
                  <Quote size={14} className='text-slate-500 dark:text-slate-400 shrink-0' />
                  <p className='text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide'>
                    Sources
                  </p>
                </div>
                <div className='space-y-2'>
                  {message.citations.map((citation, index) => (
                    <button
                      type='button'
                      key={index}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('rag:jumpToPage', { detail: { page: citation.page } }));
                      }}
                      className='w-full text-left text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors p-2 rounded bg-slate-50 dark:bg-slate-900/30 wrap-break-word'
                      title={`Jump to page ${citation.page}`}
                    >
                      <div className='flex items-start gap-2'>
                        <span className='font-bold shrink-0 text-slate-700 dark:text-slate-300'>
                          p{citation.page}
                        </span>
                        <div className='flex-1 min-w-0'>
                          {citation.snippet ? (
                            <p className='italic text-slate-600 dark:text-slate-400 wrap-break-word'>
                              "{citation.snippet.substring(0, 150)}{citation.snippet.length > 150 ? '...' : ''}"
                            </p>
                          ) : (
                            <p className='text-slate-500 dark:text-slate-500'>
                              Reference on page {citation.page}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Action Buttons */}
        {isAssistant && (
          <div className='mt-2 flex gap-2 justify-start'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => onCopy(content, message.id)}
              className='text-xs h-7'
              disabled={!content}
            >
              {isCopied ? (
                <>
                  <Check size={14} className='mr-1 text-green-600' />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={14} className='mr-1' />
                  Copy
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}