# Bad Actors「演砸了」：Codex 开发、手感打磨与部署计划

版本：2026-11-23
截止：2026-11-24 23:59，美国东部时间。
用途：给申请者与 Codex 共同执行的规格。本文是经过源码与文档研究的计划，不代表应用已经实现、付费接口已经实测或部署已经完成。

使用方法：把本文件放入项目的docs目录，让Codex先读第20节开工指令，再按第15节执行；第3节是手感验收，第7–12节是后端约束，第16节是测试，第18节是上线提交。每阶段都应交付一个可检查的结果。所有URL和账户占位符都必须替换为你自己的真实信息。

## 0. 最终产品约定

一句话：你拖动一个小人，AI 和朋友猜它在干什么。

主循环：拿到秘密题目 → 拖头、手和道具 → AI 自动观察关键姿势并猜测 → 你调整表达 → 猜中或主动揭晓 → 看这一幕的观察回放 → 换人/下一题。

最高优先级：小人本身的操纵必须流畅、有趣、可表达。网络、模型和房间状态都不能挡住本地拖动。先验证这一点，再扩大产品界面。

最新手感方向：借鉴《人类一败涂地》的软绵感与动作余韵，做一个可精确摆姿势的二维小演员。抓哪里，哪里听话；身体慢半拍跟上；松手晃一下，最后停在玩家摆好的姿势。第3.8节是这一方向的实现约定。

首版固定：

- 一个原创二维木偶，一张舞台。
- 头和两只手可拖动；腿固定。
- 手机、杯子、盘子三个道具，同一时间一个。
- 三种简单面部形状，控制眼睛、眉毛和嘴，不使用“心虚”等意图标签驱动识别。
- 先六道可见动作题，验证后扩到约十二道。
- 单人：用户表演，AI 猜。
- 多人：一个人表演，朋友和 AI 同时猜；以两到四人的体验为设计目标。
- 每轮最多五次 AI 观察。约四十五秒是体验目标，不做严格抢答倒计时、不按回答速度排名。
- 猜中或演员主动揭晓结束一轮。一次结束事件，只保留一个最终结果。
- 保存 AI 实际看过的最多五个姿势、对应猜测和已有语音，供房内重播。
- 三个外部集成：Anthropic、ElevenLabs、Speech。三者价值不等量，说明中如实解释。
- 首发英文界面与英文题库。中文界面、跨语言同义词判断留到后续。

本次不做：完整布娃娃物理、自由走动、腿部控制、摄像头、角色上传、关键帧编辑器、公开作品广场、排行榜、支付、视频导出、语音操纵身体、无限 AI 随机出题。

完成标准：评审能直接体验示例与拖动；登录后能完成真实 AI 一局；两位真实用户能完成表演、猜词、换人；第三位非成员不能读取秘密或操作房间；线上回放无需重新生成已经保存的内容。

## 1. 已查证的事实与尚未完成的验证

### 1.1 Claude 图片路径：有官方实现，仍需自己实调

官方 Evenly 收据应用用 tools.integration('anthropic/chat-completion', ...) 发送 image content block。源码先尝试 URL 图片，再尝试 base64 图片；其 tests/scan.spec.ts 也包含明确的真实视觉调用测试代码。

这证明“官方示例使用过这一调用结构”，不证明本次账号、模型、部署环境今天一定成功。没有获取到这次项目的真实通过结果，不能写“已验证视觉可用”。

参考：

- https://github.com/deepdotspace/evenly/blob/033d6b875d4a972fa77e37a04c26a7dea21fdf75/src/actions/receipts.ts
- https://github.com/deepdotspace/evenly/blob/033d6b875d4a972fa77e37a04c26a7dea21fdf75/tests/scan.spec.ts
- https://platform.claude.com/docs/en/build-with-claude/vision

注意：示例使用的模型曾为绕开当时默认模型的 404 而固定。应学习消息格式，重新验证本项目的模型，而非照搬其成本估计或错误回退。

### 1.2 SDK 与运行环境

本次检查的 SDK/scaffolder 版本为 0.44.2。实际动手时记录所安装版本，以该版本类型定义和 CLI --help 为准。

支持的 Node engines：
>=22.15.0 <23 || >=24 <25 || >=26 <27

建议 Node 24；npm 至少 11.6。保持一个包管理器、一份锁文件。

官方 skill：
https://github.com/deepdotspace/deepspace-skill/blob/main/skills/deepspace/SKILL.md

不是仓库根目录的 SKILL.md。

### 1.3 登录与公开试玩

现脚手架命名 server action 要求认证身份与 bearer；匿名 RecordProvider 不等于匿名 action。

首版决策：

- 未登录：预置姿势猜一次、自由拖动练习，标注“Sample practice”。
- 不给本地脚本反馈贴“实时 AI”标签。
- “Let AI guess”与“Play with friends”进入原生登录。
- 登录完成后回到原来的舞台，不丢掉已经摆出的姿势。
- 公开练习不调用付费接口。

这是一项明确取舍：首屏可玩，真实 AI 受账户与服务端额度约束。完整匿名 AI 试玩不在首版范围内。

### 1.4 文件与首次部署

Worker 侧有原生 appFiles 辅助，可从 deepspace/worker 导入；不需要自建 R2 服务，也不存在 ActionTools.files 这一假定接口。

appFiles 需要 APP_IDENTITY_TOKEN。第一次部署后，重新启动 dev，CLI 才能为本地环境配置文件服务所需身份。

因此：先完成账户、GitHub 来源和一个薄骨架的首次部署，再做生成音频的持久化。

### 1.5 本文没有替申请者完成的事

没有创建/切换 DeepSpace 账户，没有调用付费生成服务，没有创建应用、GitHub 仓库或线上部署，也没有做真人试玩。

工作区中没有本项目的已配置运行环境。真实验证安排在第一阶段，不能在提交说明中预填“已完成”。

## 2. 首屏、页面与角色

只做两个主要页面，回放作为房间内的结果状态。

### 首页

一个完整舞台就是主视觉。

文案建议：

- 主标题：Make a little scene.
- 副标题：You act. We guess.
- 初始示例：手机贴在耳边的小人。
- 一次短答案输入；“Your turn”始终可跳过。
- 拖动练习清楚标注 Sample practice。
- 真正 AI 按钮明确需要登录，不在进入网页时弹登录墙。
- 声音默认关闭，由用户主动开启。

### 房间页

- 顶部：当前表演者、参与者姓名、邀请入口。
- 演员：秘密题卡、可操纵舞台、三个道具、重置、揭晓。
- 观众：同一舞台，只读；文字猜答与按住说话。
- 侧边/下方：AI 当前猜测与少量历史，五个观察额度标记。
- 结束：定格画面、答案、猜测过程；“再演一题”“让朋友演”。
- 房内历史只展示少量最近回合，数据按 roundId 查询。

不做独立复杂大厅。房间创建后默认自己先演；朋友加入可以立即成为观众。下一轮由主持人选择演员。

## 3. 手感规格：先做一个值得反复拖的小人

以下数值是初始调参范围与测试目标，不是已测结果，不承诺所有设备都达到同一帧率。集中放进 feel-config，避免散落魔法数字。

### 3.1 操作时必须成立的原则

1. 被抓住的手掌在可达范围内直接跟随指针。不得给主要操纵目标加明显缓动、弹簧或网络等待。
2. 抓取时保留点击点与手柄中心的偏移，防止刚按下就跳到手掌中心。
3. 超出手臂可达范围时，手掌停在平滑的可达边界，不能断臂、无限拉长或发生数值异常。
4. 肘部保持稳定的弯曲方向；手经过肩部或身体中线时，不可突然翻到另一侧。
5. 松手后保留玩家摆好的姿势。不能自动弹回中立位置，把刚才的表达毁掉。
6. 少量回弹只能放在次要部位或很短的视觉收尾上，不能改变玩家意图中的最终位置。
7. AI 回答、字幕变化、网络广播、音频下载与保存状态，都不能让手柄停一下。
8. 对方的网络状态和自己的本地手感分开显示；离线时可继续练习，明确告知“共享暂停”。

### 3.2 输入实现

采用 Pointer Events；pointerdown 时捕获 pointer，处理 pointerup、pointercancel、lostpointercapture。

屏幕坐标通过 SVG 当前变换矩阵转换为舞台坐标。不要简单用 clientX 除以固定宽度；窗口缩放、页面滚动、手机横竖屏都需要正确映射。

- 舞台内部处理拖拽的 touch-action，页面其他区域维持正常滚动。
- 第一次拖动只接管一个指针；不要同时实现多点手势缩放。
- 手、头、道具绘制可以小，透明命中区域需足够大。触控初始按约 44–48 CSS px 测试。
- Tab 能选择手柄；方向键移动；Shift 加大步长；焦点清晰可见。
- 不使用 hover 作为唯一操作提示。
- 指针离开小手的图形区域后仍能完成拖动。
- 页面切到后台、旋转或失焦时安全结束拖动，不能永远卡在“抓住”状态。
- 控制权丢失、换轮也结束抓取；Escape 撤销本次抓取，恢复抓取前的合法姿势。

### 3.3 身体结构

用 React + SVG，固定角色几何，手臂为两段长度受限的几何解。

- 两个肩关节，固定上臂与前臂长度。
- 控制手掌目标位置，计算肘部位置。
- 长度约束须处理过近和过远两种情况，夹紧反三角函数输入，保持所有数值有限。
- 肘部方向记录在姿势/控制状态里，不能根据每一帧的符号噪声来回跳。
- 头部只允许小椭圆范围偏移与倾斜，保持颈部连接；主动倾斜可从约±20°开始调试。
- 腿固定，身体仅允许很小的视觉跟随。
- 眼睛可跟随当前拖动的手或可见道具；任何实际参与识别的视线状态必须进入同一份姿势快照。

首版不引入整套重力和碰撞。重力会让玩家摆好的姿势倒下，增加控制难度。需要的是可预测的操纵，再辅以少量角色生命感。

### 3.4 道具操作

先把“拿起、拿稳、放下”做好：

- 道具靠近手时给轻微吸附预览。
- 松手且在吸附范围内才附着到手，避免路过时突然被抢走。
- 吸附预览、正式吸附、拖动脱离分别设阈值，防止边界来回闪烁。
- 初始可尝试24 CSS px内显示预览、18 CSS px内松手附着；拖已附着道具超过约6 CSS px才脱离，避免误点掉落。阈值在屏幕空间计算，别让手机缩放改变操作难度。
- 两只手靠近时保持当前预览目标，明显更靠近另一只手才切换。
- 附着后的道具随手移动，方向受控；只给必要的“转一下”操作，不造自由变换工具栏。
- 拖动附着道具离开手可以放下，或提供明确的放下按钮。
- 放在空处的道具停在那里，首版不受重力、不滚出舞台。
- 同时只有一件道具，切换前保留手的位置。
- “放在身体后面”只有在遮挡渲染和观察描述一致时才加；否则首版全部道具在可见平面。

### 3.5 微动与视觉反馈

- 抓住：轮廓/手柄立即变化，可用很小的按压形变。
- 拖动：主体目标直接跟手；头/躯干的次要倾斜幅度很小。
- 放下：约 100–180ms 的短收尾是调参起点，不能反复抖动。
- 吸附：小幅高亮或轮廓变化即可。
- 猜中：短鞠躬、眼神或嘴角变化，不全屏撒彩纸。
- 重置：短过渡回中立；按住拖动时不接受突然重置。
- reduced motion 下取消装饰回弹和摇摆，直接控制保留。

所有“可爱”都必须服务于“我知道抓住了什么、它现在在哪、放开会怎样”。

### 3.6 本地渲染与同步分离

保持三种状态：

- 本地正在操纵的 pose：渲染的优先来源。
- 最近服务器接受的 pose：共享与重连依据。
- AI 观察时冻结的 poseSnapshot：该次猜测与回放的依据。

拖动使用独立舞台组件与 requestAnimationFrame；不要让整页 React 树每次 pointermove 都重渲染。可用 ref 保存最新输入，每帧只计算/更新必要几何。只有测到瓶颈才做更复杂的优化。

平台记录更新没有自动乐观应用，不能把网络回声当作演员手掌每帧的位置来源。

网络同步先以每秒约 8–10 次为目标；指针松开时补一次 confirmed 写入。观众可短距离插值。演员在拖动时忽略较旧的自身服务器回声，避免小人抖回旧位置。

截图导出必须使用固定 poseSnapshot，不能在等待图片编码时继续读取正在变化的 DOM。

### 3.7 手感验收与停工门槛

第一次正式联网前，至少完成这些人工检查：

- 抓住手掌边缘，不跳位。
- 快速画圈、经过头部、拖出舞台、拉到最远处，手臂不跳边、不出现 NaN。
- 缩放页面、改变窗口宽度、手机旋转后仍对得准。
- 接近吸附边缘时，道具不闪烁、不反复掉落。
- 放开后姿势稳定，玩家能精确微调。
- 断网、AI 请求在途时，操纵与离线练习一致流畅。
- 手机至少连续玩三轮，不误滚动页面、不频繁抓空。
- 一个不知道题目的观察者，能理解大部分测试姿势。

性能检查用真实设备的浏览器 Performance 工具记录连续三十秒拖动，分别覆盖本地练习、连接房间、AI请求在途三种状态。观察掉帧、长任务、每帧 React 提交与几何计算；把设备、浏览器与屏幕刷新率写入证据。60Hz 设备可用约 16.7ms 帧间隔作为检查参考。事件到渲染提交先以一至两个刷新周期为目标，这不等于完整的手指到屏幕延迟；平均 FPS 也不能证明低输入延迟。若截图/联网引入反复超过50ms的应用主线程阻塞，先定位并修复。

三个停止扩功能的条件：

1. 主要手柄明显拖后、跳位或被服务器回声拉回。
2. 玩家知道想表达什么，却经常被控制系统阻止。
3. 两个新试玩者都没有主动再摆一次的意愿。

遇到这些问题，下一步修操纵和表达能力，不增加题库、界面或集成。

### 3.8 《人类一败涂地》启发：受控的软绵感

借鉴目标是笨拙但可爱的身体反应。这份方案没有检查原作私有实现，不声称下面的二维实现就是原作物理系统。

三层分别处理：

| 层 | 规则 | 作用 |
|---|---|---|
| 主动控制 | 正在拖动的手/头直接跟随合法目标；手掌和已摆好的手部目标持久保留 | 玩家能够准确表达 |
| 身体跟随 | 躯干、肩线、非主动头部根据动作速度产生小幅滞后，再以阻尼收稳 | 重量感与软绵感 |
| 表面形变 | 衣袖/躯干轻微挤压拉伸、眼神跟随 | 角色性格，不能改坏控制点 |

第一个可玩的版本用确定的两段手臂几何，加少量受限的程序动画。无需先接完整刚体引擎。Matter.js 的约束确实支持刚度与阻尼，但一旦引入完整重力、碰撞和多身体约束，就多了关节调试、姿势保持和同步状态；是否采用应由原型证据决定，不能因为引用了原作就预设需要。

动作例子：

1. 把手迅速举起来：手立即到位，肩膀和身体轻轻被带起，头慢半拍跟随。停下后身体短暂晃一下。手不掉下来。
2. 把杯子移到嘴边：杯子随手准确到位，头有很轻的倾向，玩家停住后能保持“喝水”这个姿势。不能因为晃动反复让杯口离开嘴。
3. 快速把手左右摆两下：身体出现克制的左右晃动，动作停下后很快安静。不是整个小人像贴纸一样被整体旋转。

参数只是第一组实验值：

- 躯干最大视觉倾斜约2–4°；非主动头部附加偏摆约4–6°。
- 身体跟随的感知时间尺度约70–120ms；头部约100–160ms。用随时间更新的阻尼响应，不能实现成排队延迟输入。
- 次要部分松手收稳先试约150–250ms，至多一个小幅回摆；主要控制点立即保持。
- 衣袖/身体视觉形变先试约2–3%；不实际拉长手臂来覆盖几何错误。
- 变化小到不可见时停止动画，不无限抖动。以上数值不是从原作逆向得到，也不是性能保证。

约束优先级：手掌目标和道具握持关系最高，其次是头部主动目标，最后才是装饰性身体跟随。肩膀随躯干移动后，必须重新求解到同一手掌目标。如果某个身体摆动会让已固定的手不可达，就削弱该次身体摆动，不能把手从指针或嘴边拉走。直接拖头时不对头增加滞后。

SVG层级也要遵守这一点：不要把手掌直接放进会摇摆的身体group而让它跟着整体变换。先把肩点变换到舞台坐标，再解到舞台坐标中的手掌目标；手臂与手掌使用一致坐标系。

直接抓住仍在轻晃的头时，以它当前显示的位置计算抓取偏移，并清掉头的附加运动速度，避免接管瞬间跳位。阻尼动画按requestAnimationFrame提供的时间差更新，不按固定帧数乘常量；从后台回来要处理异常大的时间差和旧速度，不能突然弹飞。

状态要区分 authoredPose 与 motionState：前者记录玩家表达，后者记录受限的身体余动。截图/回放冻结两者合成后的实际可见姿势；观众接收可见姿势快照并插值，不在各自设备运行一套容易分叉的全身物理。AI观察触发依据玩家的实质操作，眨眼、轻晃、装饰回弹不自行递增观察额度。reduced motion 下保留精确操纵，关闭这些次要动效。

验收时做一个仅开发环境可见的开关，对比“纯直接操纵”与“加身体跟随”。让新试玩者分别做举手、喝水、左右摆手。只有在跟随版本更有生命感、完成动作同样容易、不会额外改坏姿势时才保留。先完成一次实际对比，再写“软绵感提升了体验”。

不把“整个人摔倒、爬起来、走路、抓场景物体”加入首版；它们改变了操作与题目设计的中心。可以把更夸张的塌一下留作结束后的一次短角色表演，只有核心操纵通过后再考虑。

## 4. 题目与“好玩”的验证

### 第一批六题

| 英文题目 | 检验什么 |
|---|---|
| Drinking water | 杯子与嘴的位置 |
| Talking on the phone | 手机与耳朵的位置 |
| Taking a selfie | 伸手、手机方向、头部朝向 |
| Covering your eyes | 两只手与脸的位置 |
| Surrendering | 双手高举的姿势 |
| Carrying a tray | 双手与盘子的支撑关系 |

第一批先验证能表达。随后再试打喷嚏、祈祷、飞吻、敬酒等有歧义的动作。“心虚”“偷吃”包含隐藏动机，只有盲测证明能看出来才进入题库。

猜的人必须看不到题卡。开发者先知道答案后“觉得很像”，不算有效验证。

模型不用故意猜错。它应基于可见信息提出一个真实短猜测；自然误解才构成玩法中的来回调整。

### 答案判定

- 题库留在 Worker 端。
- 每道题人工维护一个很小的可接受短语集合。
- 归一化大小写、空白、标点和少量固定开头后做明确匹配。
- 不使用简单 substring.includes，避免“not drinking”也算“drinking”。
- 不把目标词或完整候选题库发给猜词模型。
- 对意思正确但不在别名集合里的猜测，演员有“That's it / 意思对了”按钮；结果明确标注演员确认。
- 首版不增加一个拿到目标词的第二模型来裁判每次猜测，也不做抢答积分排名。

## 5. 第一阶段：真实视觉与三个集成冒烟验证

先做一小块真实验证，不先写完房间。

### 5.1 图片传输验证

准备两张简单 PNG，例如位置相反的几何图。文件名叫 probe-a、probe-b，提示词不写颜色、形状或位置答案。

两张请求除图片外相同。输出应随画面变化。HTTP 200 或模型自称“我看到了”不算证明。

请求模板如下，必须先替换纯 Base64 数据：

~~~json
{
  "model": "claude-haiku-4-5",
  "max_tokens": 120,
  "temperature": 0,
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "image",
          "source": {
            "type": "base64",
            "media_type": "image/png",
            "data": "<真实PNG的纯Base64，不带data URI前缀>"
          }
        },
        {
          "type": "text",
          "text": "Describe the visible objects and their relative positions. Use one short sentence."
        }
      ]
    }
  ]
}
~~~

模型名是待测试候选；先查当时目录，成功后固定版本，不默认采用昂贵的目录默认模型。

~~~bash
npx deepspace auth whoami --json
npx deepspace integrations info anthropic/chat-completion --json
npx deepspace integrations invoke anthropic/chat-completion \
  --body-file .local/vision-probe-a.json \
  --timeout 20000 \
  --json \
  --yes
~~~

重要说明：

- 这是实际付费调用，计费给当前 CLI 登录身份。
- --yes 是 CLI 的付费确认开关；Codex 在执行前说明即将进行的少量验证调用及次数，不盲目循环。
- .local 加入 .gitignore，不把大段 Base64、原始个人录音或凭据提交。
- CLI 超时不保证供应商已经取消或没有计费。
- 读取报错再处理。401 是身份问题，429/额度不足是限额问题，不应都判成“不支持图片”。
- 模型不可用时，根据目录明确选择另一个可用模型再做一次受控测试。

### 5.2 六个姿势的玩法验证

将经过真人盲测的六个姿势导出为约 512–640px 舞台 PNG/JPEG。只截舞台，不截题卡、聊天、说明、按钮或无障碍文本。

每次请求保留：

- 模型名。
- 图片或姿势 fixture 的编号。
- 返回猜测。
- 首个文字反馈的总耗时。
- 可用的 usage/cost。
- 是否格式有效。
- 是否合理识别动作。
- 本次是否出现错误/拒绝/超时。

起始目标：真人能辨认大半；AI 对至少一部分姿势给出可理解的相关猜测，反馈速度能支持连续调整。不要仅挑成功截图。约三至六秒内常能给短反馈可以继续尝试；如果经常超过八至十秒，应先优化模型、图片尺寸和输出，再评估回退。以上是体验门槛，不是服务 SLA。

### 5.3 程序描述回退

若视觉路径确实不可用或无法达到合理体验，保留同一玩法，切换为程序描述可见几何事实。

示例：

~~~json
{
  "headTiltDegrees": -16,
  "visibleRelations": [
    "left hand is close to the mouth",
    "right forearm is partly occluded by the torso",
    "the edge of a plate is visible beside the torso"
  ]
}
~~~

不能描述“正在偷吃”“心虚”“祈祷”，不能加入目标、题目ID、答案别名，也不能告诉模型画面中完全看不到的道具。

这个模式在 README 和界面说明中称为“reads pose structure”，不能宣传为像素视觉。模式是经过验证后的一次配置选择，不是在每次网络错误后悄悄换答案来源。

### 5.4 其他两个接口

- ElevenLabs：生成一条真实短猜测，解码 data URI，验证可播放、可以持久化。
- Speech：录一条真实英文短答案，验证实际录音格式、转写结果、空音频/拒绝录音的行为。
- 每个接口先一条成功路径与一个必要的失败分支。
- 记录模型与格式，不假定接口返回是一个公网 MP3 链接。
- 未做过的调用在证据表里写“未验证”，不要把目录存在写成上线成功。

## 6. 实时猜测：有限观察，不排队追赶用户

### 初始可调参数

| 项目 | 起点 |
|---|---|
| 每轮观察上限 | 5 |
| 姿势稳定等待 | 约 700ms |
| 两次观察开始间隔 | 至少约 4 秒 |
| 请求在途 | 一个逻辑观察请求 |
| 待处理姿势 | 只保留最新一个 |
| 截图 | 512–640px，仅舞台 |
| 输出 | 一个短猜测，最多十几个英文词 |
| 语音 | 每次一条，旧的未播音频淘汰 |
| 回合时间 | 约 45 秒体验目标，无速度排名 |

拖动中如果出现明显、稳定的新姿势，可以观察；微小抖动、同一姿势与空白状态不重复付费。

每次观察绑定：

~~~text
roundId
observationId
slot
poseRevision
poseSnapshot
requestedAt
modelId
~~~

模型输入只由已冻结的可见舞台产生。最近一两条猜测可以帮助减少重复，但不能拼接目标词或完整聊天记录。

模型输出按应用端 schema 校验。格式失败消耗本次观察，不自动再调用“修JSON”；显示温和失败信息。长度、内容类型与异常响应都要处理。

### 迟到结果的正确规则

- 跨 roundId：不得出现在新轮次、不得播到新轮次、不得结束新轮次。
- 同一轮旧姿势的正确猜测仍可以算猜中，因为它识别的是这轮已经演过的动作。
- poseRevision 用来说明它看的是哪一下，控制当前大字猜测和音频时效，不用于机械作废所有旧姿势答案。
- 已经 ended 的轮次不再重复结算。
- 如果演员一直在动，不要因为每次 poseRevision 变化就让 AI 永远无法猜中。
- AI 猜中后定格它实际看到的那个快照，必要时显示“它猜中了刚才这一下”。
- 音频较旧或回合已变时，保存结果可以继续，但不自动补播。

### 文本与语音

文字先显示。只有有人开启声音时，才按需要生成该猜测的 TTS；同一 observation 最多生成一次并缓存。

TTS 的失败只影响声音。不要用旧语音队列“填满空闲时间”，也不要播放预写错误答案冒充模型当下观察。

## 7. 数据与权限设计

优先使用原生 RecordRoom、schema 权限、唯一约束与命名 server actions。以下是设计字段，实际 TypeScript 声明以安装包为准。

同一 app scope 中存这些集合；客户端按房间过滤只是查询条件，真正安全边界是服务端权限。

| 集合 | 主要内容 | 客户端读取 | 客户端写 |
|---|---|---|---|
| rooms | 主持人、标题、创建时间 | 房间 team | 关闭 |
| team_members | room/team、user、状态、安全显示名 | 同房成员 | 关闭 |
| room_invites | roomId、邀请 token 摘要、有效性 | 关闭 | 关闭 |
| rounds | roomId、roundNo、performerId、创建时间；保持不可变 | 房间 team | 关闭 |
| round_secrets | roundId、performerId、目标和别名 | 仅该演员 | 关闭 |
| poses | roundId、performerId、poseData、poseRevision | 房间 team | 仅演员更新姿势字段 |
| observations | roundId、slot、快照、AI猜测、安全状态 | 房间 team | 关闭 |
| human_guesses | roundId、guesserId、文本、来源 | 房间 team | 关闭 |
| round_events | started/finished、时间、结束安全快照 | 房间 team | 关闭 |
| api_claims | 服务端调用额度/幂等记录 | 关闭 | 关闭 |
| audio_assets | observation 与 private stored key 的关联 | 关闭 | 关闭 |

这不是要求做十一个管理页面；这些只是小型集合，界面仍是首页与房间。

### 原生 team 与 actor 权限

- teamId 对应房间，成员只在 team_members 中维护。
- 应用级 member 不等于某个房间成员。
- 秘密题目单独放，read: own，ownerField: performerId。
- round_secrets 的 performerId 由服务器核实后写入，immutable；不要标 userBound。
- 原因：server tools 的 create 也会把 userBound 改成当前 CRUD 调用者；主持人给另一位演员建题时会写错归属。
- poses 创建关闭，ownerField 指向 immutable performerId，writableFields 仅含姿势与姿势版本。
- roomId、roundId、performerId 等不能被浏览器更新。
- 所有几何输入在服务端生成观察前验证，客户端读取到无效值也应安全退回最近合法姿势。

首版不做踢人、复杂权限撤销和主持人迁移。“离开房间”指退出当前界面，不宣称撤销所有历史访问权限。

保留 SDK 所需 users schema，使用 roster: read-policy 的收紧方式；房间显示姓名来自安全的成员投影，不为显示昵称开放所有用户记录或邮件。

### 邀请加入

- 邀请是随机高熵 token；服务端只存摘要，单独保存，不能放进所有用户可读的房间记录。
- 未加入的人只看到通用加入页面，不提前读房间内容。
- 登录后 joinRoomWithInvite 校验 token，再用当前 verified userId 建成员。
- 使用原生唯一约束防止同一人重复加入。
- 两到四人是首版界面与测试范围。如果声称严格人数上限，必须实现并发安全的座位分配并测试；否则不要把一次读后写的计数包装成硬上限。

## 8. 回合状态：不可变编号与唯一事件

不依赖可被迟到响应覆盖的 room.currentRoundId/status。

- rounds.uniqueOn = [roomId, roundNo]
- round_secrets.uniqueOn = [roundId]
- poses.uniqueOn = [roundId]
- round_events.uniqueOn = [roundId, kind]
- observations.uniqueOn = [roundId, slot]

kind 只接受 started、finished。

所有唯一创建都使用新的记录 ID。指定固定 ID 的 tools.create 可能走 upsert，不能当 create-if-absent。

### 开始或恢复一轮

1. 验证调用者是主持人，选择的演员是已加入成员。
2. 查询当前最大 roundNo。
3. 如果上一轮已存在但初始化未完成，恢复同一轮。
4. 如果有 started 没有 finished，继续这一轮，不另开。
5. 否则用下一个编号创建不可变 round meta；并发创建受唯一约束约束。
6. 幂等补齐 secret 和初始 pose。已有 secret 必须复用，不能重新抽题。
7. 只有 secret、pose 均有效时才插入 started。
8. 重复 started 插入失败后读取已有事件。

### 结束一轮

- 触发来源：合法答案、演员明确“意思对了”、演员主动揭晓。
- 核对原 roundId 和 started。
- finished 使用新记录 ID 插入；唯一约束保证只有一个终局事件。
- 重复/并发结束读取既有结果，不重复产生终局。
- finished 保存安全揭晓词、原因、对应观察 ID、最终 poseSnapshot 与本次回放包含的观察 ID。
- 原 secret 保持演员私有，无需临时改权限。
- 不写增量累计积分。首版没有速度排名。

UI 派生顺序：

1. 有 finished：已结束。
2. 否则有 started：进行中。
3. 否则：初始化中。

这里利用的是单条记录唯一性，不是跨多条记录的事务。初始化中断与重复动作必须用测试验证。

## 9. 服务端动作清单

所有 action 的身份来自 verified JWT。模板工具是特权工具，不会替应用完成每条记录的成员授权。

| 动作 | 必须检查 | 结果 |
|---|---|---|
| createRoom | 登录身份与创建频率 | 房间、主持人成员、邀请 |
| joinRoomWithInvite | token 有效、登录身份 | 成员行，重复加入幂等 |
| startOrResumeRound | 主持人、演员是成员、上一轮状态 | 同一轮完成初始化或新一轮 |
| requestGuess | 当前演员、成员、已started未finished、合法pose/图片、额度 | 一个有快照的观察 |
| submitHumanGuess | 当前观众、成员、原roundId、短文本 | 猜测与可能的结束事件 |
| acceptGuess | 当前演员、猜测属于当前轮 | 标注演员确认的结束 |
| revealRound | 当前演员/主持人、当前轮 | 揭晓结束 |
| ensureGuessAudio | 成员、observation归属、一次性额度 | 缓存语音的状态 |
| transcribeGuess | 观众、成员、短录音限制、次数 | 可修改转写，不自动冒充人工提交 |
| getRoomAudio | 已验证身份、成员、完整资源归属 | 授权音频字节流 |

requireRoomMember 等名称是本项目自己写的 helper，不是 SDK 现成导出。Codex 必须读类型，不可凭名字假设接口。

requestGuess 不接受客户端指定 provider、model、system prompt、任意URL或计费身份。客户端传来的额外字段不能混进模型请求。

## 10. 付费调用、并发与失败

### 每轮观察额度

服务端为 slot 0..4 创建 observation 申请，uniqueOn(roundId, slot)。

- 只有插入成功的请求执行上游调用。
- 重复请求读取已有状态。
- 失败、响应格式错误或超时都消费这次尝试。
- 上一 slot 完成或超过其明确等待期限，才可开始下一 slot。
- 前端单请求在途；服务端也校验顺序，不只禁用按钮。
- worker 中断后不能悄悄重复付费。卡住的申请按超时处理，保留已消费槽位。
- 这是应用级至多一次尝试控制，不承诺供应商 exactly-once；网络超时可能仍计费。

### 全应用与用户额度

除了每轮五次，还需服务器限制：

- 每个用户短时间创建回合的次数。
- 每人每轮 Speech 录音次数，例如最多三次，每次约三秒。
- 每个观察最多一次 TTS，短文本长度封顶。
- 应用每日各类请求总数，作为费用刹车。
- 一个 owner-only 设置可以关闭新付费调用，公开练习和已保存回放继续工作。

初始数量由实际账单决定。可先用有限的每日请求总数，不承诺尚未测量的“每局固定成本”。

api_claims 可采用 server-only、claimKey 唯一的消耗型预约：

- 资源申请唯一键，例如 tts + observationId。
- 日预算槽位唯一键，例如 UTC日期 + provider类别 + slot编号。
- 每次都新 ID 插入；只有成功者继续。
- 先拿完必要预约再调用供应商。
- 两次写不是事务：中断可能消耗一个没有实际用掉的额度，允许保守少用；不能导致额外重复消费。
- 不用“读计数再加一”伪装并发安全。
- 只记录应用自己构造的有限键与状态，不接受客户端选择预算所属日期或用户。

### 封住旁路

现脚手架 integrations 配置不是供应商 allowlist；未配置集成也可能默认记开发者账单。

- 关闭浏览器直接调用通用付费 integration proxy 的入口。
- 三个集成只通过命名 actions。
- 检查未使用的通用 AI/agent/chat 路由是否还能触发开发者费用，关闭不需要的付费表面。
- 本项目不需要浏览器任意上传/删除文件，收紧通用文件写入口。
- 别把前端看不见按钮当作额度控制。

## 11. 语音：增强体验，但不拖住玩法

### ElevenLabs

- 输入仅为已接受的 AI 猜测文本，使用固定普通角色声线。
- 默认静音；用户点击后启用声音。
- 字幕永远先于声音可用。
- 新猜测到来时淘汰未播放的旧猜测音频，避免排队念过时内容。
- 关声音、换轮、离开房间立即停止播放。
- TTS 与图片请求分开，不等待 TTS 才继续观察。
- TTS 失败展示文字，继续游戏。

### Speech

- 仅观众按住按钮时录音，不常开麦克风。
- 初始上限约三秒，编码后再限制字节数。
- 实测浏览器实际录音 MIME 与平台支持的载荷；不要假定任意 MediaRecorder 格式都能转写。
- 录音期间暂停本机 AI 语音，避免把电脑自己说的答案再录进去。
- 转写后先让用户看见、修改，再提交。
- 识别失败、空音频、权限拒绝、浏览器不支持时始终保留键盘。
- 原始猜答录音默认不持久保存，只保留用户确认提交的文字。
- 不按语音完成时间评“最快”，避免转写延迟影响公平。

第三个集成是手机观众的便利入口；不要在 writeup 中把它夸成玩法不可缺少的核心。

## 12. 原生 R2 保存与房间授权播放

生成语音统一放进应用所有者的 private self 文件区，用 appFiles，stored key 留在 server-only audio_assets。

示意代码，仅展示已查证 SDK 调用；音频解码、错误处理和成员校验需要项目自行实现：

~~~ts
import { appFiles } from 'deepspace/worker'

const files = appFiles(env, {
  scope: 'self',
  userId: env.OWNER_USER_ID,
})

const saved = await files.upload(
  new Blob([audioBytes], { type: 'audio/mpeg' }),
  {
    key: 'bad-actors/audio/' + observationId + '.mp3',
    name: observationId + '.mp3',
  },
)

// 保存 saved.key；不手工拼平台内部文件路径。
~~~

OWNER_USER_ID 必须来自可信平台 binding，不能由请求参数指定。

新增应用自己的路由：

~~~text
GET /api/rooms/:roomId/audio/:observationId
~~~

路由先验证身份、房间成员关系、observation/round/audio 的一致归属，再用固定 OWNER_USER_ID 的 appFiles.download(storedKey) 读文件。

返回至少设置：

~~~text
Cache-Control: private, no-store
Vary: Cookie, Authorization
Content-Type: audio/mpeg
X-Content-Type-Options: nosniff
~~~

前端可以：

- 复用模板现有同源 session-read 认证后直接 audio src；
- 或带 bearer fetch 到 Blob，再用 Object URL 播放，离开时释放。

采用哪一种由当前模板类型与实测决定。不要把 bearer 放进 URL。

关键区别：Record 的 team 权限不会自动让 self 文件变成多人共享文件；必须经过上述房间授权路由。不要改用公开 app 文件区来偷偷绕过。

先部署薄骨架，重启 dev，再验证 appFiles。没有 app identity 时不要重复调文件服务并把错误误诊成上传实现问题。

## 13. 回放与完成瞬间

回放只保存最多五个 AI 观察点，不录屏、不存每帧轨迹。

每一点包含 poseSnapshot、观察顺序、guess、可选已生成 audio 标识。finished 保存本次回放选中的 observationIds，后续迟到结果不偷偷改变这个已完成片段。

- 回放用同一个 PuppetStage 渲染。
- 默认按观察顺序展示，用户可以点回某一帧看“它为什么猜这个”。
- 使用已经保存的声音；原来没有生成的声音不在回放时偷偷付费补齐。
- 首版只给房间成员回看。
- 公开分享和社交作品墙延后；邀请码用于共同游戏，不自动公开历史内容。

最后一个有温度的瞬间可以很小：小人放松下来，鞠一躬，下面出现“Somehow, they got it.”。猜不中也给“Want to try a different pose?”，避免嘲笑用户。

## 14. 代码组织

以脚手架现有结构为准，不替换整套运行时：

~~~text
src/pose/
  types.ts
  validate.ts
  kinematics.ts
  visibleFacts.ts
  renderPose.ts
  feel-config.ts
src/components/puppet/
  PuppetStage.tsx
  usePuppetDrag.ts
  PropTray.tsx
src/game/
  roundState.ts
  normalizeGuess.ts
  observationScheduler.ts
src/components/game/
  GuessFeed.tsx
  GuessVoicePlayer.tsx
  HumanGuessInput.tsx
  RoundReplay.tsx
src/server/
  challenges.ts
  authorization.ts
  round-actions.ts
  observation-actions.ts
  speech-actions.ts
  audio-route.ts
  quota.ts
src/schemas/
  game-schemas.ts
src/pages/
  使用脚手架既有文件路由与(app) provider边界
tests/
  pose.unit.test.ts
  round-state.unit.test.ts
  privacy.spec.ts
  multiplayer.spec.ts
  failures.spec.ts
docs/
  DECISIONS.md
  VERIFICATION.md
  SUBMISSION.md
~~~

名字是建议模块，不是要求机械创建空文件。小模块可以合并，保持职责清楚。

三个边界特别重要：

- PoseData 不含题目、答案、当前猜测。
- 模型请求构造不导入 challenges，也不读取 secret。
- 服务器答案判定能读 secret，但它的输入不能回流给猜词模型。

不要让题库因一个方便的 shared import 被打包进客户端。

## 15. 按阶段执行

### 阶段 A：账户、脚手架、视觉探针与薄部署

产物：版本记录、正确用户身份、GitHub remote、可打开的薄骨架、真实接口探针结果。

先在本机终端进入准备存放新项目的父目录。不要在旧Plan B或Pocket Secret项目中覆盖文件。执行脚手架并cd后，后续命令都在新项目根目录运行；Codex也应打开这一目录。

~~~bash
node --version
npm --version
git --version
npm create deepspace@0.44.2 bad-actors-shi
cd bad-actors-shi
npx -y skills@latest add deepdotspace/deepspace-skill -y
npx deepspace auth whoami --json
~~~

版本不满足要求时先处理环境，再运行脚手架。创建提交前检查git config user.name与git config user.email；缺少时由申请者选择自己的提交身份，不能让agent编造。

bad-actors-shi 只是候选名称，不代表子域名可用。遇到占用，按返回信息选择带个人标识的名称。

仅未登录/身份错误时：

~~~bash
npx deepspace auth login
npx deepspace auth whoami --json
~~~

先确认是申请者自己的账号与正确环境。不要为绕过登录问题创建代理自己的 staging 身份。

身份正确后：

~~~bash
npx deepspace app init --json
~~~

注册完成再提交应用身份。当前 app init 可能自动生成初始 commit，查看 git status 后只提交仍有变化的文件。

创建准备提交的 GitHub 空仓库，核对已有 remote，连接到正确仓库：

先在你的GitHub账号下真实创建空仓库。初次创建时不自动添加README、许可证或.gitignore，避免与本地脚手架产生无关历史冲突。DeepSpace登录和GitHub推送认证是两回事；推送要求后者也已可用。

~~~bash
git remote -v
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/bad-actors.git
git log -1 --oneline
git status --short
~~~

如果尚无提交，先检查待提交文件、按明确路径暂存，再创建初始提交。不要在没有提交时直接push，否则会出现src refspec main does not match any。已有origin时不要重复执行remote add；先核对它是否就是准备提交的仓库。

确认已有提交后：

~~~bash
git push -u origin main
npx deepspace app source --json
npx deepspace status --json
~~~

若已有 origin，先读它，不覆盖已有仓库。GitHub URL 必须替换成用户真实仓库。源码是否公开由用户选定的仓库设置决定，评审必须能访问。

首次部署前app source仍显示尚未绑定，可以是预期状态。不要为了消除提示运行deepspace push。下一步应核实GitHub remote、提交与推送，再按本流程首次deploy。

开始开发：

~~~bash
npx deepspace dev start --port 5173
~~~

使用CLI实际打印的本地地址。若当前运行方式占用终端，保留它，在另一个终端执行其余命令。首次部署成功后，按CLI支持的方式重启本地开发服务，再验证appFiles所需的应用身份。

安装后查看必要命令帮助，读真实 SDK types。按第5节执行有限付费探针。

探针命令不能直接空跑：Codex必须先生成两张测试图片，以及.local/vision-probe-a.json和.local/vision-probe-b.json，写入真实图片Base64，确认.local/已被Git忽略，然后再调用接口。

薄骨架通过后，先把代码提交推送，再部署：

~~~bash
npx deepspace deploy --json
~~~

GitHub source 绑定发生在首次 source-producing action。首次 deploy 前必须接好 GitHub remote；本流程不使用 deepspace push。deploy --no-push 也不能规避来源绑定。

app init 注册身份和首次 deploy 来源绑定是不同步骤。

### 阶段 B：只打磨木偶

产物：能独立玩的练习舞台、六个姿势、手机与桌面手感检查。

先不接房间、不接积分、不制作大量题目。完成第3节手感验收与第4节真人盲测。

先交付可达约束与跟手，再加第3.8节的软绵身体跟随；两版对比。未经试玩，不靠增加晃动幅度来声称更接近《人类一败涂地》。

Codex 实现几何与输入；申请者亲手玩，具体指出“哪一下不舒服”，调整参数。记录至少一两项实际改动，例如肘部翻边、吸附太强、手柄太小。没有发生过的改动不要写进面试故事。

### 阶段 C：单人真实观察闭环

产物：登录后真实 AI 能观察姿势、显示猜测、继续调整、结束并看观察回放。

- 实现 PoseData 与截图/可见事实适配器。
- 单请求、最新姿势、五次额度、服务端授权。
- 使用真实接口验证至少一轮。
- 字幕可完整玩，TTS 可以暂时后接。
- 第一版就处理跨轮迟到结果。
- 在此阶段固定 observationMode 与模型，不不停新增供应商。

### 阶段 D：多人、秘密与幂等

产物：A创建、B加入、A演B猜、下一轮B演；C无邀请码被拒绝。

- 原生 records/schema/team/owner 权限。
- 不可变 round meta 与 started/finished 事件。
- 私有题目、invites、观察请求额度。
- 两人并发结束/重复开始测试。
- 页面刷新与断线重连。
- actor直接写pose的权限不允许观众伪造写入。

### 阶段 E：TTS、Speech、R2与回放

产物：三个集成真实各跑通一次；同房第二用户能播放缓存语音。

- 用 appFiles 保存短语音。
- 房间授权媒体路由。
- 声音开关、旧音频淘汰。
- 手机按住说，转写确认提交。
- 回放复用已保存资料。
- 通用付费代理与浏览器文件写入口收紧。

### 阶段 F：视觉统一、验证与最终发布

产物：完整线上主流程、可访问仓库、诚实 writeup 与验证记录。

- 英文文案、空状态、网络异常、权限拒绝。
- 真手机调整、键盘操作、reduced motion。
- 最后一次手感回归，特别确认新UI没有使舞台卡顿。
- 最后 commit/push/deploy 后，用全新会话验证线上。
- 记录最终 commit 与 deployment release。
- 手动将 live URL、repository、writeup 填到任务页。

## 16. 测试：把时间花在具体风险上

### 有价值的单元测试

- kinematics：最远、最近、过肩、过中线、极端坐标都不产生 NaN/断臂/跳边。
- visibleFacts：不描述完全遮挡的物件，不包含动作意图标签。
- normalizeGuess：同义词可识别，否定句不被子串错误命中。
- roundState：finished 优先于 started；乱序事件不回退。
- scheduler：五次上限、单请求、微动不重复、最新pose替换队列。
- model payload：相同pose、不同secret时，送给模型的内容保持相同；避免“刚好不含一个字符串”这种弱测试。

### 多人集成测试

使用 deepspace/testing 的 users(3)，账号不足会 skip，不能把 skipped 当通过。

1. A建房，B有邀请加入，C无邀请无法加入。
2. B能看到A姿势；B不能改A姿势。
3. B和C的HTTP/WebSocket载荷没有A的秘密题目。
4. C不能调用A那一轮的观察、转写、语音资源。
5. 同一观察slot并发请求只触发一次模拟provider调用。
6. 重复start/resume只出现一个started且不换题。
7. 猜中与主动揭晓并发，只出现一个finished。
8. 同轮旧pose的正确猜测仍可结束这一轮。
9. 旧轮结果不能展示到新轮、不能播放旧轮音频。
10. 私有音频对B可用，对C拒绝；直接self文件URL不能被其他用户读取。
11. 付费泛用入口被阻断，不能绕过命名action限额。
12. 重播不调用任何新生成接口。

mock 只放在外部付费服务边界；不要 mock 掉应用自己的认证、记录权限和动作流程。

### 真实人工与线上检查

- 两个独立真实 OAuth 会话完成一局并交换角色。
- 浏览器桌面与一台真实手机。
- 麦克风拒绝、空音频、TTS失败、模型错误、额度用尽。
- 断线时提示准确，重连后按服务器轮次恢复。
- 看请求次数，连续拖十秒不会产生几十次AI请求。
- 当前用户退出后，私有房间与音频不会靠缓存继续对陌生会话暴露。
- 线上部署后再次验证，不用本地通过代替线上结果。

命令：

~~~bash
npm run type-check
npx deepspace test accounts list --usable
npx deepspace test run all --port 5180
~~~

当前 CLI 的默认 test run 只跑 quick smoke/api；all 才包括新增完整测试。测试 runner 自己占用服务器端口，不复用开发中的5173，使用5180。

test accounts list --usable只列出现有可用测试账号，不会自动创建三位用户。先查看当前版本的test accounts --help完成必要配置；账号不足、测试skip时将多人权限验证标为未完成。

测试账号使用官方CLI支持的方法配置，密码不进命令行、日志或仓库。先读该版本 --help；不要复制旧文档的明文密码例子。

## 17. 排期与削减顺序

这是截止前的执行顺序，不假装还有完整五天。用实际阶段结果调时间。

建议的投入分配：

- 手感、表达与试玩：约三分之一。
- 单人观察与多人权限：约三分之一。
- 音频、失败状态、线上验证和说明：约三分之一。

11月23日优先完成：
账户/仓库/探针 → 早期部署 → 木偶手感 → 单人真实观察。

11月24日优先完成：
多人与权限 → 三个集成闭环 → 线上验证 → 说明与提交。

建议在11月24日晚间提前冻结功能，给部署故障与门户提交留出数小时。具体工作时段按申请者安排，不按估计工时保证一定完成。

如果时间紧，按顺序削减：

1. 第二批题目、额外表情与遮挡技巧。
2. 复杂的重播过渡，保留观察点逐个查看。
3. 更多历史、公开分享、社交功能。
4. 额外动效和音效装饰。

不能削减：
主要操纵手感、真实AI单人闭环、真实双用户流程、秘密权限、费用上限、失败反馈、三个集成的真实验证、部署与仓库一致性。

如果核心手感不过关，停止扩大范围，优先把六道基础题做扎实。题目少可以诚实说明；控制不顺会伤害每一局。

## 18. 最终部署清单

先完成必需验证，再检查待提交文件：

~~~bash
npm run type-check
npx deepspace test run all --port 5180
git status --short
~~~

只暂存明确需要提交的文件，确认 .local、凭据、个人录音、测试账号不在列表中。然后：

使用git add -- 后接逐项检查过的真实路径（这是命令语法说明，不要把中文说明作为参数）。随后检查暂存区：

~~~bash
git diff --cached --stat
git diff --cached
~~~

确认无敏感数据和无关文件，再执行：

~~~bash
git commit -m "Ship Bad Actors"
git push origin main
git status --short
npx deepspace app source --json
npx deepspace status --json
npx deepspace deploy --json
npx deepspace releases
npx deepspace app usage
~~~

如果没有待提交变化，不为执行模板强行创建空commit。

GitHub source 部署包含本地未提交内容，最终必须 clean，并且HEAD已推送。记录 release 对应 commit，避免线上与仓库不一致。

部署输出成功后：

从本次部署输出复制真实live URL；不要根据候选项目名猜线上地址。

- 打开真实HTTPS地址。
- 未登录：首页可见、示例可玩、练习不触发付费。
- 新用户登录后能完成一轮真实AI。
- 两个真实会话能完成多人换人。
- 第三用户无法读取私有数据。
- 语音能被同房第二用户读取。
- 关声音依然完整可玩。
- 仓库没有密钥，README 的URL与实际地址一致。
- 不依赖一个会过期的日期或只在开发电脑存在的资源。

如果首次注册/登录被平台拒绝，保留原始code与环境信息，按CLI返回的action处理。没有action时，不擅自换身份、改appId或删除其他app腾配额。

## 19. README、提交说明与现场讲解

README 至少包含：

- 一句话介绍。
- 真实应用截图或短录屏；截图必须来自已实现产品。
- 可点击 live URL。
- 30–60秒体验说明。
- 单人和多人怎么玩。
- 三个集成的作用与降级方式。
- 数据/权限边界。
- 如何本地运行、测试与部署。
- 已知限制和下一步。
- 开源参考及实际复用代码/素材的许可证说明。

VERIFICATION.md 分开写：
自动化通过、外部接口mock、真实接口调用、真人试玩、线上检查、尚未验证。

SUBMISSION.md 英文模板，完成后替换方括号，不提交带占位的版本：

~~~text
Bad Actors is a small multiplayer charades game. One player poses a 2D puppet while friends and an AI audience guess the action.

I built it with DeepSpace authentication, synchronized records, server-enforced permissions, server actions, and private file storage. Anthropic [interprets stage screenshots / reads validated pose descriptions], ElevenLabs voices the AI's guesses, and Speech provides optional spoken guesses for spectators.

My main tradeoff was a deliberately small, controllable puppet and a curated set of actions. I prioritized direct manipulation, private prompts, bounded AI calls, and reliable round transitions over full-body physics, rankings, and a public gallery.

Codex helped implement [actual modules]. I personally verified [actual checks] and changed [actual decisions based on testing]. The main remaining limitation is [actual limitation]. Next I would [one focused improvement].
~~~

不要把AI做的自动化测试写成“我亲自验证”，不要预先宣称手感被两位朋友认可。把真实过程留下即可。

现场最值得讲清楚的五点：

1. 为什么手柄本地直接响应，网络只负责共享状态。
2. 为什么题目与观察输入分开，模型没有拿到答案。
3. 为什么观察slot和finished事件用唯一约束，为什么不是跨记录事务。
4. 为什么同轮旧姿势猜中仍有效，跨轮返回必须隔离。
5. 为什么第三项Speech只是便利输入，为什么没有为了数量扩张玩法。

## 20. 给 Codex 的开工指令

把本文放到仓库的 docs 中，然后给 Codex：

~~~text
请按 Bad Actors 计划带我完成这个 DeepSpace 面试项目。

产品已定：用户拖动固定二维小人，AI和朋友猜动作。最高优先级是直接操纵手感和表达能力。范围为一个角色、头和两只手、手机杯子盘子三个道具、六道初始题、每轮最多五次AI观察、一个真实多人房间、房内观察回放。

手感借鉴《人类一败涂地》的软绵感：抓住的控制点准确跟手，躯干和非主动头部小幅慢半拍，松手短暂收稳且保留姿势。先做可控原型，再添加次要身体跟随并让我比较。不做完整3D布娃娃、重力闯关或全身控制；肩膀摆动不得把手从目标拉开，装饰晃动不得触发AI观察。

先完整读官方DeepSpace skill、项目已有说明和实际安装类型。先核实账号与版本，设置准备提交的GitHub来源；首次deploy前不运行deepspace push。不要重用Plan B/Pocket Secret的app身份。

按计划分阶段执行。先准备真实图片probe、验证三个集成的基本输入输出，尽早部署薄骨架。随后先打磨木偶：本地跟手、稳定手臂、可预测吸附、触控命中、离线仍流畅。让我进行短试玩后再扩大范围。

AI只看截图或可见几何描述，绝不拿目标词、题库或答案。没有真实调用证据时不要说“视觉已验证”。实时猜测是变化后观察，有限频率、单请求、最新姿势、服务端额度。不要故意伪造错误猜测。

优先使用原生records、team/own权限、唯一约束和server actions。每个特权动作自己核对成员和角色。不要将读后写当事务；轮次不可变，started/finished事件唯一；同轮旧姿势可被猜中，跨轮不能串结果。

三个集成采用Anthropic、ElevenLabs、Speech。语音为可选体验，文字完整可玩；不增加语音操纵身体。音频用原生appFiles私有保存，经房间授权路由供成员读取。

每个阶段给我：实现内容、运行结果、一个最有价值的人工检查、剩余风险，并更新VERIFICATION.md。可以自主完成已授权的代码、测试与修复，不要每个文件都问我。需要我的OAuth操作或真实手感判断时，给一个具体清楚的动作。发现方向性风险先报告证据，不偷偷加功能或换产品。

现在先执行阶段A与木偶的最小原型，完成后让我检查：抓取会不会跳位、手臂会不会翻边、手机能否抓得住、六个动作能否让不知题目的人理解。
~~~

## 21. 参考来源

### DeepSpace

- 官方 skill：https://github.com/deepdotspace/deepspace-skill/blob/main/skills/deepspace/SKILL.md
- 文档索引：https://docs.deep.space/llms.txt
- 安装：https://docs.deep.space/get-started/installation.md
- 来源控制：https://docs.deep.space/guides/source-control.md
- 权限：https://docs.deep.space/concepts/permissions.md
- 实时同步：https://docs.deep.space/concepts/realtime-sync.md
- 外部API：https://docs.deep.space/guides/external-apis
- 文件：https://docs.deep.space/guides/file-uploads.md
- 集成目录：https://api-worker.deep.space/api/integrations
- action路由：https://github.com/deepdotspace/deepspace/blob/fc50d2e0ad0211bd69e68ca011bbdcb5efba871e/packages/create-deepspace/templates/base/src/server/action-routes.ts
- 通用HTTP路由：https://github.com/deepdotspace/deepspace/blob/fc50d2e0ad0211bd69e68ca011bbdcb5efba871e/packages/create-deepspace/templates/base/src/server/http-routes.ts
- 记录写入：https://github.com/deepdotspace/deepspace/blob/fc50d2e0ad0211bd69e68ca011bbdcb5efba871e/packages/deepspace/src/server/handlers/records.ts
- appFiles：https://github.com/deepdotspace/deepspace/blob/fc50d2e0ad0211bd69e68ca011bbdcb5efba871e/packages/deepspace/src/server/utils/app-files.ts
- 集成CLI：https://github.com/deepdotspace/deepspace/blob/fc50d2e0ad0211bd69e68ca011bbdcb5efba871e/packages/deepspace/src/cli/commands/integrations.ts
- 测试CLI：https://github.com/deepdotspace/deepspace/blob/fc50d2e0ad0211bd69e68ca011bbdcb5efba871e/packages/deepspace/src/cli/commands/test.ts

### 玩法与前端

- Human: Fall Flat官方产品介绍：https://curvegames.com/zh/our-games/human-fall-flat/
- Matter.js约束API：https://brm.io/matter-js/docs/classes/Constraint.html
- SVG屏幕坐标变换：https://developer.mozilla.org/en-US/docs/Web/API/SVGGraphicsElement/getScreenCTM
- Pose Animator：https://github.com/yemount/pose-animator
- Quick, Draw!：https://quickdraw.withgoogle.com/
- Quick Draw数据：https://github.com/googlecreativelab/quickdraw-dataset
- Matter.js约束示例：https://github.com/liabru/matter-js/blob/master/examples/constraints.js
- Pointer capture：https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture
- requestAnimationFrame：https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- touch-action：https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
- reduced motion：https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion

开源参考用于理解机制。没有运行这些项目的在线demo，不保证其旧依赖今天可直接安装。复用实际代码时保留对应许可证；角色与界面资产自己制作。

