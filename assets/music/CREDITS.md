# 网站背景音乐来源

作者：Kevin MacLeod (https://incompetech.com/)

授权：Creative Commons Attribution 4.0（CC BY 4.0）
https://creativecommons.org/licenses/by/4.0/

来源与授权核验日期：2026-09-25。作者官网曲目目录的署名模板明确提供 CC BY 4.0：
https://incompetech.com/music/royalty-free/music.html

| 板块 | 文件 | 曲名 | 官方曲目页面 |
| --- | --- | --- | --- |
| 首页 | home-carefree.mp3 | Carefree | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400037 |
| AIGC | ai-bit-quest.mp3 | Bit Quest | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500073 |
| 自媒体 | media-funk-game-loop.mp3 | Funk Game Loop | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100839 |
| PPT | ppt-wallpaper.mp3 | Wallpaper | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100843 |

## 原始下载地址

- https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3
- https://incompetech.com/music/royalty-free/mp3-royaltyfree/Bit%20Quest.mp3
- https://incompetech.com/music/royalty-free/mp3-royaltyfree/Funk%20Game%20Loop.mp3
- https://incompetech.com/music/royalty-free/mp3-royaltyfree/Wallpaper.mp3

## 本站处理

保留完整曲目，使用 FFmpeg 统一响度并转为 44.1 kHz、双声道、96 kbps MP3；删除原始文件元数据，署名保存在本文档和网站页脚“音乐鸣谢”。未声称音乐为本站原创。

转换参数：`-map_metadata -1 -af loudnorm=I=-22:TP=-4:LRA=9 -ar 44100 -ac 2 -codec:a libmp3lame -b:a 96k`。

曲目按需加载，切页先淡出当前曲目、再淡入新曲目；播放完成后从头循环。完整曲目之间不保证无缝循环。
