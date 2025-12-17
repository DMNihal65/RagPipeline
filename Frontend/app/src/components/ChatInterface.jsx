import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Send, Upload, FileText, LogOut, ChevronRight, MessageSquare, Plus, X, Globe, ExternalLink, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PDFViewer from './PDFViewer';

const ChatInterface = () => {
  const { token, logout, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activePdf, setActivePdf] = useState(null); // For viewing
  const [activeDocId, setActiveDocId] = useState(null); // For chatting
  const [activePage, setActivePage] = useState(1);
  const [documents, setDocuments] = useState([]);
  const [webSearchMode, setWebSearchMode] = useState(false); // Web search toggle
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get('http://rag.cmti.online/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setDocuments(response.data);
    } catch (error) {
      console.error("Failed to fetch documents", error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://rag.cmti.online/ingest', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      // Refresh doc list and select the new doc
      await fetchDocuments();
      setActiveDocId(response.data.doc_id);
      setActivePdf(file); // View it immediately

      setMessages(prev => [...prev, {
        role: 'system',
        content: `File "${file.name}" processed successfully. You are now chatting with this document.`
      }]);
      setFile(null);
    } catch (error) {
      console.error("Upload failed", error);
      setMessages(prev => [...prev, { role: 'system', content: 'Failed to upload file.' }]);
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');

    // Add loading message
    const loadingMessage = { role: 'assistant', content: 'Thinking...', isLoading: true };
    setMessages(prev => [...prev, loadingMessage]);
    scrollToBottom();

    try {
      let response;

      if (webSearchMode) {
        // Web search mode
        response = await axios.post('http://rag.cmti.online/web-query', null, {
          params: { question: currentInput },
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } else {
        // Document search mode
        const params = { question: currentInput };
        if (activeDocId) {
          params.doc_id = activeDocId;
        }
        response = await axios.post('http://rag.cmti.online/query', null, {
          params: params,
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }

      // Remove loading message and add actual response
      setMessages(prev => {
        const newMessages = prev.filter(msg => !msg.isLoading);
        return [...newMessages, {
          role: 'assistant',
          content: response.data.response.answer,
          citations: response.data.response.citations,
          isWebSearch: webSearchMode
        }];
      });
      scrollToBottom();
    } catch (error) {
      console.error("Query failed", error);
      setMessages(prev => {
        const newMessages = prev.filter(msg => !msg.isLoading);
        return [...newMessages, { role: 'system', content: 'Failed to get response. Please try again.' }];
      });
    }
  };

  const handleCitationClick = (page) => {
    setActivePage(page);
  };

  const selectDocument = async (doc) => {
    setActiveDocId(doc.id);

    try {
      const response = await axios.get(`http://rag.cmti.online/documents/${doc.id}/file`, {
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      });

      const pdfUrl = URL.createObjectURL(response.data);
      // Create a file-like object for the viewer
      const fileObj = new File([response.data], doc.filename, { type: 'application/pdf' });
      setActivePdf(fileObj);

      setMessages(prev => [...prev, {
        role: 'system',
        content: `Switched context to "${doc.filename}".`
      }]);
    } catch (error) {
      console.error("Failed to load PDF", error);
      setMessages(prev => [...prev, { role: 'system', content: `Failed to load PDF for "${doc.filename}".` }]);
    }
  };

  return (
    <div className="flex h-screen bg-white text-stone-800 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-gradient-to-b from-stone-50 to-white border-r border-stone-200 flex flex-col shadow-lg">
        <div className="p-4 flex items-center gap-3 border-b border-stone-200 bg-white">
          <div className="flex items-center gap-2 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-1.5 shadow-md">
            <img src="./logo.png" className="w-8 h-8" alt="Logo" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-stone-800 tracking-tight">Custom AI Chatbot</h1>
            <p className="text-xs text-stone-500 font-medium">RAG-powered assistant</p>
          </div>
        </div>

        <div className="p-3 flex-1 overflow-y-auto scroll-smooth">
          <div className="mb-6">
            <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-3 pl-2">Upload Document</h3>
            <div className="flex flex-col gap-2">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="flex items-center justify-center px-3 py-2.5 bg-white hover:bg-stone-50 rounded-xl cursor-pointer transition-all border border-stone-200 hover:border-stone-300 hover:shadow-md text-xs text-stone-600 shadow-sm group"
              >
                <Plus size={14} strokeWidth={2} className="mr-2 text-stone-400 group-hover:text-stone-600 transition-colors" />
                {file ? <span className="font-medium text-stone-900">{file.name.substring(0, 15)}...</span> : 'Select PDF'}
              </label>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`flex items-center justify-center px-3 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm ${!file || uploading
                  ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-stone-900 to-stone-800 hover:from-stone-800 hover:to-stone-700 text-white shadow-md hover:shadow-lg'
                  }`}
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Uploading...
                  </span>
                ) : (
                  <>
                    <Upload size={14} strokeWidth={2} className="mr-2" /> Upload PDF
                  </>
                )}
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-3 pl-2">Your Documents</h3>
            <div className="space-y-1">
              <button
                onClick={() => { setActiveDocId(null); setMessages(prev => [...prev, { role: 'system', content: 'Switched to All Documents context.' }]); }}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs transition-all ${activeDocId === null
                  ? 'bg-gradient-to-r from-teal-50 to-blue-50 text-teal-700 shadow-sm border border-teal-200 font-semibold'
                  : 'text-stone-500 hover:bg-white hover:text-stone-700 hover:shadow-sm'
                  }`}
              >
                <MessageSquare size={14} strokeWidth={2} className={`mr-2.5 ${activeDocId === null ? 'text-teal-600' : 'text-stone-400'}`} />
                All Documents
              </button>
              {documents.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => selectDocument(doc)}
                  className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs transition-all ${activeDocId === doc.id
                    ? 'bg-gradient-to-r from-teal-50 to-blue-50 text-teal-700 shadow-sm border border-teal-200 font-semibold'
                    : 'text-stone-500 hover:bg-white hover:text-stone-700 hover:shadow-sm'
                    }`}
                >
                  <FileText size={14} strokeWidth={2} className={`mr-2.5 ${activeDocId === doc.id ? 'text-teal-600' : 'text-stone-400'}`} />
                  <span className="truncate text-left">{doc.filename}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-stone-200 bg-white">
          <button
            onClick={logout}
            className="flex items-center w-full px-3 py-2.5 text-xs text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all font-medium"
          >
            <LogOut size={14} strokeWidth={2} className="mr-2" /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex relative bg-gradient-to-br from-stone-50 via-white to-stone-50">
        {/* Chat Area */}
        <div className={`flex-1 flex flex-col ${activePdf ? 'w-1/2' : 'w-full'} transition-all duration-500 ease-in-out`}>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-stone-400 animate-fade-in">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl mb-6 flex items-center justify-center border border-stone-200 shadow-lg">
                  <MessageSquare size={32} strokeWidth={1.5} className="text-stone-400" />
                </div>
                <p className="text-lg font-semibold text-stone-700 mb-2">Welcome to RAG Chatbot</p>
                <p className="text-sm text-stone-500 max-w-md text-center">Select a document, upload a PDF, or use web search to get started</p>
                <div className="mt-8 flex gap-2">
                  <div className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-600 shadow-sm">
                    💬 Ask questions
                  </div>
                  <div className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-600 shadow-sm">
                    📄 Upload documents
                  </div>
                  <div className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-600 shadow-sm">
                    🌐 Web search
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group animate-fade-in`}>
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-900 flex items-center justify-center shadow-sm">
                    <Bot size={16} className="text-white" />
                  </div>
                )}
                
                <div
                  className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : ''} ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-2xl rounded-tr-sm shadow-lg'
                      : msg.role === 'system'
                        ? 'bg-stone-50 text-stone-500 text-xs border border-stone-100 w-full text-center py-2 rounded-lg'
                        : 'bg-white text-stone-800 rounded-2xl rounded-tl-sm border border-stone-200 shadow-md hover:shadow-lg transition-shadow'
                  }`}
                >
                  {msg.role === 'user' && (
                    <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                      <div className="w-6 h-6 rounded-full bg-stone-700 flex items-center justify-center">
                        <User size={12} className="text-white" />
                      </div>
                      <span className="text-xs font-medium text-stone-300">You</span>
                    </div>
                  )}

                  <div className={`px-4 ${msg.role === 'user' ? 'pb-3 pt-0' : 'py-3'}`}>
                    {msg.role === 'assistant' ? (
                      msg.isLoading ? (
                        <div className="flex items-center gap-2 text-stone-500">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-stone-400 rounded-full animate-pulse-dot" style={{ animationDelay: '0s' }}></div>
                            <div className="w-2 h-2 bg-stone-400 rounded-full animate-pulse-dot" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-2 h-2 bg-stone-400 rounded-full animate-pulse-dot" style={{ animationDelay: '0.4s' }}></div>
                          </div>
                          <span className="text-sm">Thinking...</span>
                        </div>
                      ) : (
                        <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-stone-900 prose-headings:mt-4 prose-headings:mb-2 prose-p:text-stone-700 prose-p:leading-relaxed prose-p:my-3 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-stone-900 prose-strong:font-semibold prose-blockquote:border-l-stone-300 prose-blockquote:text-stone-600 prose-blockquote:my-4 prose-ul:my-3 prose-ol:my-3 prose-li:my-1.5 prose-hr:my-6">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ node, inline, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || '');
                                if (!inline && match) {
                                  // Code block (multi-line)
                                  return (
                                    <div className="relative my-4">
                                      <div className="absolute top-2 right-3 text-[10px] text-stone-300 font-mono bg-stone-800/80 px-2 py-0.5 rounded z-10">
                                        {match[1]}
                                      </div>
                                      <pre className="bg-stone-900 border border-stone-700 rounded-lg overflow-x-auto p-4 my-2">
                                        <code className="text-stone-100 font-mono text-sm leading-relaxed" {...props}>
                                          {children}
                                        </code>
                                      </pre>
                                    </div>
                                  );
                                }
                                // Inline code
                                return (
                                  <code className="bg-stone-100 text-stone-900 px-1.5 py-0.5 rounded text-xs font-mono font-semibold border border-stone-200" {...props}>
                                    {children}
                                  </code>
                                );
                              },
                              table({ children }) {
                                return (
                                  <div className="overflow-x-auto my-4 rounded-lg border border-stone-200">
                                    <table className="min-w-full divide-y divide-stone-200">
                                      {children}
                                    </table>
                                  </div>
                                );
                              },
                              th({ children }) {
                                return (
                                  <th className="px-4 py-3 bg-stone-50 text-left text-xs font-semibold text-stone-700 border-b border-stone-200">
                                    {children}
                                  </th>
                                );
                              },
                              td({ children }) {
                                return (
                                  <td className="px-4 py-3 text-sm text-stone-600 border-b border-stone-100">
                                    {children}
                                  </td>
                                );
                              },
                              h1({ children }) {
                                return <h1 className="text-xl font-bold text-stone-900 mt-6 mb-3">{children}</h1>;
                              },
                              h2({ children }) {
                                return <h2 className="text-lg font-semibold text-stone-900 mt-5 mb-2">{children}</h2>;
                              },
                              h3({ children }) {
                                return <h3 className="text-base font-semibold text-stone-900 mt-4 mb-2">{children}</h3>;
                              },
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )
                    ) : (
                      <p className="leading-relaxed whitespace-pre-wrap text-sm">{msg.content}</p>
                    )}

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-stone-200">
                        <p className="text-[10px] font-bold text-stone-400 mb-2.5 uppercase tracking-widest">Sources</p>
                        <div className="flex flex-wrap gap-2">
                          {msg.citations.map((cit, cIdx) => (
                            msg.isWebSearch ? (
                              // Web citation with clickable URL
                              cit.url ? (
                                <a
                                  key={cIdx}
                                  href={cit.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center px-2.5 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 rounded-lg text-[10px] text-blue-700 transition-all hover:border-blue-300 hover:shadow-sm group"
                                >
                                  <Globe size={11} className="mr-1.5 text-blue-500" />
                                  <span className="font-medium max-w-[150px] truncate">{cit.domain || (cit.url ? new URL(cit.url).hostname : 'Unknown')}</span>
                                  <ExternalLink size={10} className="ml-1.5 text-blue-400 group-hover:text-blue-600 transition-colors" />
                                </a>
                              ) : (
                                <div
                                  key={cIdx}
                                  className="flex items-center px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-[10px] text-stone-600"
                                >
                                  <Globe size={11} className="mr-1.5 text-stone-400" />
                                  <span className="font-medium">{cit.domain || cit.title || 'Unknown source'}</span>
                                </div>
                              )
                            ) : (
                              // Document citation with page number
                              <button
                                key={cIdx}
                                onClick={() => handleCitationClick(cit.page)}
                                className="flex items-center px-2.5 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg text-[10px] text-stone-600 transition-all hover:border-stone-300 hover:shadow-sm group"
                              >
                                <FileText size={11} className="mr-1.5 text-stone-500" />
                                <span className="font-medium">Page {cit.page}</span>
                                <ChevronRight size={10} className="ml-1.5 text-stone-400 group-hover:text-stone-600 transition-colors" />
                              </button>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-stone-700 to-stone-800 flex items-center justify-center shadow-sm order-2">
                    <User size={16} className="text-white" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-white/90 backdrop-blur-md border-t border-stone-200 shadow-lg">
            <div className="max-w-4xl mx-auto">
              {webSearchMode && (
                <div className="mb-3 flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 animate-fade-in">
                  <Globe size={14} className="animate-pulse" />
                  <span className="font-semibold">Web Search Mode Active</span>
                </div>
              )}
              <div className={`flex items-center gap-2 bg-white rounded-2xl p-2 border transition-all shadow-lg hover:shadow-xl ${webSearchMode
                ? 'border-blue-300 ring-2 ring-blue-100'
                : 'border-stone-200 focus-within:border-stone-400 focus-within:ring-2 focus-within:ring-stone-100'
                }`}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder={webSearchMode ? "Search the web..." : "Ask a question or type your message..."}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-stone-900 px-4 py-2.5 placeholder:text-stone-400"
                />
                <button
                  onClick={() => setWebSearchMode(!webSearchMode)}
                  className={`p-2.5 rounded-xl transition-all ${webSearchMode
                    ? 'bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 hover:from-blue-200 hover:to-indigo-200 shadow-sm'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }`}
                  title={webSearchMode ? "Switch to Document Search" : "Switch to Web Search"}
                >
                  <Globe size={18} strokeWidth={2} />
                </button>
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="p-2.5 bg-gradient-to-br from-stone-900 to-stone-800 hover:from-stone-800 hover:to-stone-700 text-white rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md hover:shadow-lg disabled:hover:shadow-md"
                >
                  <Send size={18} strokeWidth={2} />
                </button>
              </div>
              <p className="text-[10px] text-stone-400 mt-2 text-center">Press Enter to send, Shift+Enter for new line</p>
            </div>
          </div>
        </div>

        {/* PDF Viewer Panel */}
        {activePdf && (
          <div className="w-1/2 border-l border-stone-200 bg-stone-50 flex flex-col shadow-xl z-10">
            <div className="p-3 border-b border-stone-200 flex justify-between items-center bg-white">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="p-1 bg-red-50 rounded">
                  <FileText size={14} className="text-red-500" />
                </div>
                <span className="text-xs font-semibold text-stone-700 truncate">{activePdf.name}</span>
              </div>
              <button
                onClick={() => setActivePdf(null)}
                className="p-1.5 hover:bg-stone-100 rounded-full text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden relative bg-stone-100/50">
              <PDFViewer file={activePdf} pageNumber={activePage} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;