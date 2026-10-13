(() => {
  'use strict';

  const innovationPages = window.INNOVATION_PAGES.pages.map(({ src, width, height, page }) => ({ src, width, height, page }));
  const firePages = window.WANSHAN_FIRE_PAGES.pages.map(({ src, width, height, page }) => ({ src, width, height, page }));
  const workReportPages = window.WORK_REPORT_PAGES.pages.map(({ src, width, height, page }) => ({ src, width, height, page }));
  const { src, width, height } = innovationPages[0];

  window.PPT_DECKS = [
    {
      id: 'time',
      title: '时间的主权',
      cover: { src: '../assets/ppt-gallery/time.webp', width: 1600, height: 900 },
      pages: [{ src: '../assets/ppt-gallery/time.webp', width: 1600, height: 900, page: 1 }]
    },
    {
      id: 'innovation',
      title: '智联万物',
      cover: { src, width, height },
      pages: innovationPages
    },
    {
      id: 'scroll',
      title: '字里行间，古韵今声',
      cover: { src: '../assets/ppt-gallery/scroll.webp', width: 1280, height: 720 },
      pages: [
        { src: '../assets/ppt-gallery/scroll-closed.webp', width: 1280, height: 720, page: 1 },
        { src: '../assets/ppt-gallery/scroll.webp', width: 1280, height: 720, page: 2 }
      ]
    },
    {
      id: 'green',
      title: '绿水青山就是金山银山',
      cover: { src: '../assets/ppt-gallery/green.webp', width: 1280, height: 720 },
      pages: [{ src: '../assets/ppt-gallery/green.webp', width: 1280, height: 720, page: 1 }]
    },
    {
      id: 'rural',
      title: '乡村振兴',
      cover: { src: '../assets/ppt-gallery/rural.webp', width: 1280, height: 720 },
      pages: [{ src: '../assets/ppt-gallery/rural.webp', width: 1280, height: 720, page: 1 }]
    },
    {
      id: 'long-march',
      title: '大江东去',
      cover: { src: '../assets/ppt-gallery/long-march.webp', width: 1280, height: 720 },
      pages: [{ src: '../assets/ppt-gallery/long-march.webp', width: 1280, height: 720, page: 1 }]
    },
    {
      id: 'wanshan-fire',
      title: '提、拔、按、压 · 万山消防',
      cover: firePages[0],
      pages: firePages
    },
    {
      id: 'work-report',
      title: '工作汇报',
      cover: workReportPages[0],
      pages: workReportPages
    }
  ];
})();
