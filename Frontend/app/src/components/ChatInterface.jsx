import { useState, useRef, useEffect } from 'react';
import { askQuestion } from './lib/api';
import { Send, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ChatMessage from './ChatMessage';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ChatInterface({ pdfFile, onCitationsChange, isMobile }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 0);
    }
  }, [messages, loading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message to state
    const userMessageObj = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
    };
    setMessages((prev) => [...prev, userMessageObj]);

    setLoading(true);

    try {
      // Call API
      const response = await askQuestion(userMessage);

      // Extract answer and citations from API response
      // Handle different response formats
      let answer = '';
      let citations = [];

      if (response?.response?.answer) {
        answer = response.response.answer;
        citations = response.response.citations || [];
      } else if (response?.answer) {
        answer = response.answer;
        citations = response.citations || [];
      } else {
        // Fallback if response structure is different
        answer = JSON.stringify(response);
      }

      // Create assistant message object
      const assistantMessageObj = {
        id: Date.now() + 1,
        role: 'assistant',
        content: answer,
        citations: citations,
      };

      // Add assistant message
      setMessages((prev) => [...prev, assistantMessageObj]);

      // Update highlights in parent component
      if (citations.length > 0) {
        onCitationsChange(citations);
      }
    } catch (error) {
      console.error('Chat error:', error);

      // Add error message
      const errorMessageObj = {
        id: Date.now() + 2,
        role: 'error',
        content: error?.message || 'Failed to get response. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessageObj]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (content, id) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleClearChat = () => {
    setMessages([]);
    setInput('');
    onCitationsChange([]);
  };

  const suggestedQuestions = [
    'What is the main topic of this document?',
    'Can you summarize the key points?',
    'What are the important conclusions?',
  ];

  return (
    <div className='h-full min-h-0 flex flex-col bg-white dark:bg-slate-900'>
      {/* Header */}
      <div className='border-b bg-white dark:bg-slate-900 px-4 py-4 shrink-0'>
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='font-semibold text-slate-900 dark:text-white flex items-center gap-2'>
              <Sparkles size={18} className='text-slate-700 dark:text-slate-300' />
              Chat with PDF
            </h2>
            <p className='text-xs text-slate-500 dark:text-slate-400 mt-1'>
              Ask questions about your document
            </p>
          </div>
          {messages.length > 0 && (
            <Button
              variant='ghost'
              size='sm'
              onClick={handleClearChat}
              className='text-xs'
            >
              <RotateCcw size={14} className='mr-1' />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className='flex-1 min-h-0 px-4 py-4' ref={scrollAreaRef}>
        <div className='space-y-4 max-w-3xl pr-4'>
          {messages.length === 0 ? (
            <div className='h-full flex flex-col items-center justify-center py-12 text-center'>
              <div className='inline-flex items-center justify-center h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4'>
                <Sparkles size={32} className='text-slate-700 dark:text-slate-300' />
              </div>
              <h3 className='text-lg font-semibold text-slate-900 dark:text-white mb-2'>
                Start Your Conversation
              </h3>
              <p className='text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-xs'>
                Ask questions about your document and get intelligent answers powered by RAG
              </p>

              <div className='space-y-2 w-full max-w-sm'>
                <p className='text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide'>
                  Suggested Questions
                </p>
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => setInput(question)}
                    className='w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm text-slate-700 dark:text-slate-300'
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onCopy={handleCopy}
                  isCopied={copiedId === message.id}
                />
              ))}
              {loading && (
                <div className='flex justify-start'>
                  <Card className='bg-blue-50 dark:bg-blue-950 border-0'>
                    <div className='px-4 py-3 flex items-center gap-2'>
                      <div className='h-4 w-4 bg-blue-500 rounded-full animate-bounce' />
                      <p className='text-sm text-blue-900 dark:text-blue-100'>
                        Thinking...
                      </p>
                    </div>
                  </Card>
                </div>
              )}
              <div ref={scrollRef} />
            </>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className='border-t bg-white dark:bg-slate-900 p-4 shrink-0'>
        <form onSubmit={handleSendMessage} className='space-y-3'>
          <div className='flex gap-2 items-stretch flex-nowrap'>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Ask a question...'
              disabled={loading}
              className='text-sm flex-1 min-w-0'
              autoFocus
            />
            <Button
              type='submit'
              disabled={loading || !input.trim()}
              size='sm'
              className='px-4 bg-slate-900 text-white hover:bg-slate-800 shrink-0'
            >
              {loading ? (
                <div className='h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
              ) : (
                <Send size={16} />
              )}
            </Button>
          </div>
          <p className='text-xs text-slate-500 dark:text-slate-400'>
            Powered by RAG • Get accurate answers from your document
          </p>
        </form>
      </div>
    </div>
  );
}