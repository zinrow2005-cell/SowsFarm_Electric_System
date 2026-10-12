/*
 * 虎尾場 2D CAD 配置系統 V6.7
 * PWA Service Worker 註冊
 *
 * 注意：app-core.js 保持原本大型 IIFE 的作用域，
 * 不任意拆散 let / const 狀態，避免再次發生跨 script 作用域錯誤。
 */

if('serviceWorker' in navigator && location.protocol.startsWith('http')){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
