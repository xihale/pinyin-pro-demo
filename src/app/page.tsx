'use client';

import { useEffect, useRef } from 'react';
import page from './page.module.scss';

import { pinyin } from 'pinyin-pro';

export default function Home() {

  const textRef = useRef<HTMLTextAreaElement>(null);
  const resRef = useRef<HTMLDivElement>(null);

  const handleChange = () => {
    if (!textRef.current || !resRef.current) return;
    
    const text = textRef.current.value;
    const pinyinText = pinyin(text);

    resRef.current.innerText = pinyinText;
    if(navigator.clipboard?.writeText !== null && window.isSecureContext)
      resRef.current.setAttribute('data-hint', '点击即可复制');
  };

  const handleCopy = () => {
    if (!resRef.current) return;
    if(navigator.clipboard?.writeText !== null && window.isSecureContext)
      navigator.clipboard.writeText(resRef.current.innerText),
      resRef.current.setAttribute('data-hint', '已复制');
    else{
      resRef.current.setAttribute('data-hint', '请手动复制');
    }
  }

  useEffect(() => {
    handleChange();
    textRef.current?.addEventListener('input', handleChange);
  }, [textRef]);

  useEffect(() => {
    if(!resRef.current) return;
    if(navigator.clipboard?.writeText !== null && window.isSecureContext)
      resRef.current.addEventListener('click', handleCopy);
    else{
      resRef.current.style.cursor = 'default';
      resRef.current.style.setProperty('--hover-event', 'none');
    }
  }, [resRef]);

  return (
    <div className={page.container}>
      <textarea ref={textRef}></textarea>
      <div className={page.result} ref={resRef}></div>
    </div>
  );
}