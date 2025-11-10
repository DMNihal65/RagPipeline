'use client';

import { useState, useRef, useEffect } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import PdfUploader from './components/PdfUploader';
import PDFViewer from './components/PDFViewer';
import ChatInterface from './components/ChatInterface';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function App() {
  const [pdf, setPdf] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showPdfPanel, setShowPdfPanel] = useState(true);
  const [highlights, setHighlights] = useState([]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handlePdfUpload = (file, url) => {
    setPdf(url);
    setPdfFile(file);
  };

  if (!pdf) {
    return <PdfUploader onUploaded={handlePdfUpload} />;
  }

  return (
    <div className='h-screen flex flex-col bg-slate-50 dark:bg-slate-950'>
      {/* Header */}
      <header className='sticky top-0 z-40 border-b bg-white dark:bg-slate-900'>
        <div className='flex items-center justify-between h-16 px-4 md:px-6'>
          <div className='flex items-center gap-3'>
            <div className='h-10 w-10 rounded-lg bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center'>
              <img src="/logo.png" alt="logo" />
            </div>
            <div>
              <h1 className='text-lg font-bold text-slate-900 dark:text-white'>RAG Chatbot</h1>
              <p className='text-xs text-slate-500 dark:text-slate-400'>PDF Intelligence</p>
            </div>
          </div>

          {isMobile && (
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setShowPdfPanel(!showPdfPanel)}
              className='lg:hidden'
            >
              {showPdfPanel ? <X size={20} /> : <Menu size={20} />}
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className='flex-1 overflow-hidden'>
        {isMobile ? (
          // Mobile: Stacked view
          <div className='h-full flex flex-col'>
            {showPdfPanel ? (
              <div className='flex-1 overflow-auto border-b'>
                <PDFViewer file={pdf} highlights={highlights} />
              </div>
            ) : (
              <div className='flex-1 flex flex-col'>
                <ChatInterface
                  pdfFile={pdfFile}
                  onCitationsChange={setHighlights}
                  isMobile={true}
                />
              </div>
            )}
          </div>
        ) : (
          // Desktop: Split view with resizable panels
          <ResizablePanelGroup direction='horizontal' className='h-full'>
            <ResizablePanel defaultSize={80} minSize={25} className='hidden lg:flex lg:flex-col'>
              <div className='flex-1 overflow-hidden flex flex-col'>
                {/* <div className='p-4 border-b bg-white dark:bg-slate-900'>
                  <h2 className='font-semibold text-slate-900 dark:text-white'>Document</h2>
                </div> */}
                <div className='flex-1 overflow-auto'>
                  <PDFViewer file={pdf} highlights={highlights} />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle className='hidden lg:flex' />

            <ResizablePanel defaultSize={60} minSize={25} className='flex flex-col'>
              <ChatInterface
                pdfFile={pdfFile}
                onCitationsChange={setHighlights}
                isMobile={false}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </div>
  );
}