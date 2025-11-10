import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Highlighter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export default function PDFViewer({ file, highlights }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [highlightedPages, setHighlightedPages] = useState(new Set());
  const [citationPages, setCitationPages] = useState([]);
  const [citationIndex, setCitationIndex] = useState(0);

  // Extract highlighted page numbers from citations
  useEffect(() => {
    if (highlights && highlights.length > 0) {
      const pages = new Set(highlights.map((h) => h.page));
      setHighlightedPages(pages);
      const ordered = Array.from(pages).sort((a, b) => a - b);
      setCitationPages(ordered);
      setCitationIndex(0);
    }
  }, [highlights]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const handlePreviousPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 2));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.8));
  };

  const handleJumpToHighlight = () => {
    if (highlightedPages.size > 0) {
      const firstHighlightedPage = Math.min(...highlightedPages);
      setPageNumber(firstHighlightedPage);
    }
  };

  const handlePrevCitation = () => {
    if (citationPages.length === 0) return;
    const nextIndex = (citationIndex - 1 + citationPages.length) % citationPages.length;
    setCitationIndex(nextIndex);
    setPageNumber(citationPages[nextIndex]);
  };

  const handleNextCitation = () => {
    if (citationPages.length === 0) return;
    const nextIndex = (citationIndex + 1) % citationPages.length;
    setCitationIndex(nextIndex);
    setPageNumber(citationPages[nextIndex]);
  };

  useEffect(() => {
    const onJump = (e) => {
      if (e?.detail?.page) {
        setPageNumber(e.detail.page);
        const idx = citationPages.indexOf(e.detail.page);
        if (idx >= 0) setCitationIndex(idx);
      }
    };
    window.addEventListener('rag:jumpToPage', onJump);
    return () => window.removeEventListener('rag:jumpToPage', onJump);
  }, [citationPages]);

  return (
    <div className='h-full flex flex-col bg-white dark:bg-slate-900'>
      {/* Toolbar */}
      <div className='flex items-center justify-between px-4 py-3 border-b bg-slate-50 dark:bg-slate-800 gap-2 flex-wrap'>
        <div className='flex items-center gap-1'>
          <Button
            variant='ghost'
            size='sm'
            onClick={handlePreviousPage}
            disabled={pageNumber === 1}
            className='h-9'
            title='Previous page'
          >
            <ChevronLeft size={18} />
          </Button>

          <div className='px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-sm font-medium text-slate-900 dark:text-white min-w-fit'>
            {pageNumber} / {numPages || '...'}
          </div>

          <Button
            variant='ghost'
            size='sm'
            onClick={handleNextPage}
            disabled={pageNumber === numPages}
            className='h-9'
            title='Next page'
          >
            <ChevronRight size={18} />
          </Button>
        </div>

        <div className='flex items-center gap-1'>
          <Button
            variant='ghost'
            size='sm'
            onClick={handleZoomOut}
            disabled={scale <= 0.8}
            className='h-9'
            title='Zoom out'
          >
            <ZoomOut size={18} />
          </Button>

          <div className='px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-sm font-medium text-slate-900 dark:text-white min-w-fit'>
            {Math.round(scale * 100)}%
          </div>

          <Button
            variant='ghost'
            size='sm'
            onClick={handleZoomIn}
            disabled={scale >= 2}
            className='h-9'
            title='Zoom in'
          >
            <ZoomIn size={18} />
          </Button>

          {citationPages.length > 0 && (
            <div className='flex items-center gap-1 ml-2'>
              <Button
                variant='ghost'
                size='sm'
                onClick={handlePrevCitation}
                className='h-9'
                title='Previous citation'
              >
                <ChevronLeft size={18} />
              </Button>
              <div className='px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-xs font-medium min-w-16 text-center'>
                {citationIndex + 1} / {citationPages.length}
              </div>
              <Button
                variant='ghost'
                size='sm'
                onClick={handleNextCitation}
                className='h-9'
                title='Next citation'
              >
                <ChevronRight size={18} />
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={handleJumpToHighlight}
                className='h-9 text-yellow-700 dark:text-yellow-300'
                title={`Jump to first citation (Page ${citationPages[0]})`}
              >
                <Highlighter size={18} />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Citation Info Bar */}
      {citationPages.length > 0 && (
        <div className='px-4 py-2 bg-yellow-50 dark:bg-yellow-950/30 border-b border-yellow-200 dark:border-yellow-800 text-xs text-yellow-800 dark:text-yellow-200'>
          <span className='font-semibold'>Citations:</span>{' '}
          {citationPages.join(', ')}
        </div>
      )}

      {/* PDF Viewer */}
      <div className='flex-1 overflow-auto flex items-start justify-center bg-slate-50 dark:bg-slate-900 p-4'>
        <div className='bg-white dark:bg-slate-900 rounded-lg shadow border border-slate-200 dark:border-slate-700 overflow-hidden'>
          {loading && (
            <div className='flex items-center justify-center h-96 bg-slate-50 dark:bg-slate-800'>
              <div className='text-center'>
                <div className='inline-flex items-center justify-center h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700 mb-3'>
                  <div className='h-6 w-6 border-2 border-slate-900 dark:border-white border-t-transparent rounded-full animate-spin' />
                </div>
                <p className='text-sm text-slate-600 dark:text-slate-400'>Loading PDF...</p>
              </div>
            </div>
          )}

          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div />}
            error={
              <div className='p-8 text-center text-red-600 dark:text-red-400'>
                Failed to load PDF. Please try another file.
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={true}
              className={`shadow-sm ${
                highlightedPages.has(pageNumber) ? 'ring-2 ring-yellow-400' : ''
              }`}
            />
          </Document>
        </div>
      </div>
    </div>
  );
}