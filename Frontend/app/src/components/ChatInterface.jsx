import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Send, Upload, FileText, LogOut, ChevronRight, MessageSquare, Plus, X, Globe, ExternalLink } from 'lucide-react';
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
      const response = await axios.get('http://localhost:6568/documents', {
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
      const response = await axios.post('http://localhost:6568/ingest', formData, {
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
    setInput('');

    try {
      let response;

      if (webSearchMode) {
        // Web search mode
        response = await axios.post('http://localhost:6568/web-query', null, {
          params: { question: userMessage.content },
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } else {
        // Document search mode
        const params = { question: userMessage.content };
        if (activeDocId) {
          params.doc_id = activeDocId;
        }
        response = await axios.post('http://localhost:6568/query', null, {
          params: params,
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }

      const botMessage = {
        role: 'assistant',
        content: response.data.response.answer,
        citations: response.data.response.citations,
        isWebSearch: webSearchMode
      };

      setMessages(prev => [...prev, botMessage]);
      scrollToBottom();
    } catch (error) {
      console.error("Query failed", error);
      setMessages(prev => [...prev, { role: 'system', content: 'Failed to get response.' }]);
    }
  };

  const handleCitationClick = (page) => {
    setActivePage(page);
  };

  const selectDocument = async (doc) => {
    setActiveDocId(doc.id);

    try {
      const response = await axios.get(`http://localhost:6568/documents/${doc.id}/file`, {
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
      <div className="w-64 bg-stone-50 border-r border-stone-200 flex flex-col">
        <div className="p-4 flex items-center gap-2 border-b border-stone-200">
          <div className="flex items-center gap-2 bg-slate-900 rounded-lg"><img src="./logo.png" className="w-8 h-8" alt="" /></div>

          <h1 className="text-lg font-bold text-stone-800 tracking-tight">Custom AI Chatbot</h1>
          {/* <p className="text-xs text-stone-500 mt-0.5 font-medium">Logged in as {user?.username}</p> */}
        </div>

        <div className="p-3 flex-1 overflow-y-auto">
          <div className="mb-6">
            <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2 pl-2">Upload Document</h3>
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
                className="flex items-center justify-center px-3 py-2 bg-white hover:bg-stone-100 rounded-lg cursor-pointer transition-all border border-stone-200 hover:border-stone-300 text-xs text-stone-600 shadow-sm group"
              >
                <Plus size={14} strokeWidth={2} className="mr-2 text-stone-400 group-hover:text-stone-600 transition-colors" />
                {file ? <span className="font-medium text-stone-900">{file.name.substring(0, 15)}...</span> : 'Select PDF'}
              </label>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`flex items-center justify-center px-3 py-2 rounded-lg text-xs font-medium transition-all shadow-sm ${!file || uploading
                  ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                  : 'bg-stone-900 hover:bg-stone-800 text-white'
                  }`}
              >
                {uploading ? 'Uploading...' : <><Upload size={14} strokeWidth={2} className="mr-2" /> Upload PDF</>}
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2 pl-2">Your Documents</h3>
            <div className="space-y-0.5">
              <button
                onClick={() => { setActiveDocId(null); setMessages(prev => [...prev, { role: 'system', content: 'Switched to All Documents context.' }]); }}
                className={`w-full flex items-center px-3 py-2 rounded-lg text-xs transition-all ${activeDocId === null
                  ? 'bg-white text-teal-700 shadow-sm border border-stone-200 font-semibold'
                  : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'
                  }`}
              >
                <MessageSquare size={14} strokeWidth={2} className={`mr-2.5 ${activeDocId === null ? 'text-teal-600' : 'text-stone-400'}`} />
                All Documents
              </button>
              {documents.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => selectDocument(doc)}
                  className={`w-full flex items-center px-3 py-2 rounded-lg text-xs transition-all ${activeDocId === doc.id
                    ? 'bg-white text-teal-700 shadow-sm border border-stone-200 font-semibold'
                    : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'
                    }`}
                >
                  <FileText size={14} strokeWidth={2} className={`mr-2.5 ${activeDocId === doc.id ? 'text-teal-600' : 'text-stone-400'}`} />
                  <span className="truncate text-left">{doc.filename}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-stone-200 bg-stone-50/50">
          <button
            onClick={logout}
            className="flex items-center w-full px-3 py-2 text-xs text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={14} strokeWidth={2} className="mr-2" /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex relative">
        {/* Chat Area */}
        <div className={`flex-1 flex flex-col ${activePdf ? 'w-1/2' : 'w-full'} transition-all duration-500 ease-in-out`}>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-stone-400">
                <div className="w-16 h-16 bg-stone-50 rounded-full mb-4 flex items-center justify-center border border-stone-100">
                  <MessageSquare size={24} strokeWidth={1.5} className="text-stone-300" />
                </div>
                <p className="text-base font-medium text-stone-600">Welcome to RAG Chatbot</p>
                <p className="text-xs mt-1">Select a document, upload a PDF, or use web search</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-xl shadow-sm ${msg.role === 'user'
                    ? 'bg-stone-900 text-white rounded-tr-sm'
                    : msg.role === 'system'
                      ? 'bg-stone-50 text-stone-500 text-xs border border-stone-100 w-full text-center py-1.5'
                      : 'bg-white text-stone-800 rounded-tl-sm border border-stone-200'
                    }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap text-sm">{msg.content}</p>

                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-stone-100/50">
                      <p className="text-[10px] font-bold text-stone-400 mb-2 uppercase tracking-widest">Sources</p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((cit, cIdx) => (
                          msg.isWebSearch ? (
                            // Web citation with clickable URL
                            <a
                              key={cIdx}
                              href={cit.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center px-2 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-[10px] text-blue-700 transition-all hover:border-blue-300 group"
                            >
                              <Globe size={10} className="mr-1 text-blue-500" />
                              <span className="font-medium max-w-[150px] truncate">{cit.domain || new URL(cit.url).hostname}</span>
                              <ExternalLink size={10} className="ml-1 text-blue-400 group-hover:text-blue-600" />
                            </a>
                          ) : (
                            // Document citation with page number
                            <button
                              key={cIdx}
                              onClick={() => handleCitationClick(cit.page)}
                              className="flex items-center px-2 py-1 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded text-[10px] text-stone-600 transition-all hover:border-stone-300"
                            >
                              <span className="font-medium">Page {cit.page}</span>
                              <ChevronRight size={10} className="ml-0.5 text-stone-400" />
                            </button>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-stone-100">
            <div className="max-w-3xl mx-auto">
              {webSearchMode && (
                <div className="mb-2 flex items-center gap-2 text-xs text-blue-600">
                  <Globe size={14} className="animate-pulse" />
                  <span className="font-medium">Web Search Mode Active</span>
                </div>
              )}
              <div className={`flex items-center gap-2 bg-white rounded-xl p-1.5 border transition-all shadow-sm ${webSearchMode
                  ? 'border-blue-300 ring-2 ring-blue-50'
                  : 'border-stone-200 focus-within:border-stone-300 focus-within:ring-2 focus-within:ring-stone-50'
                }`}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={webSearchMode ? "Search the web..." : "Ask a question..."}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-stone-900 px-3 py-1.5 placeholder:text-stone-400"
                />
                <button
                  onClick={() => setWebSearchMode(!webSearchMode)}
                  className={`p-2 rounded-lg transition-all ${webSearchMode
                      ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                      : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }`}
                  title={webSearchMode ? "Switch to Document Search" : "Switch to Web Search"}
                >
                  <Globe size={16} strokeWidth={2} />
                </button>
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="p-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm hover:shadow"
                >
                  <Send size={16} strokeWidth={2} />
                </button>
              </div>
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