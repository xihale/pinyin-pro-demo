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
    resRef.current.setAttribute('data-hint', '点击即可复制');
  };

  const handleCopy = () => {
    if (!resRef.current) return;
    navigator.clipboard.writeText(resRef.current.innerText);
    resRef.current.setAttribute('data-hint', '已复制');
  }

  useEffect(() => {
    textRef.current?.addEventListener('input', handleChange);
  }, [textRef]);

  useEffect(() => {
    resRef.current?.addEventListener('click', handleCopy);
  }, [resRef]);

  return (
    <div className={page.container}>
      <textarea ref={textRef}></textarea>
      <div className={page.result} ref={resRef} data-hint="点击即可复制"></div>
    </div>
  );
}