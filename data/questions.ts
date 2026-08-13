import {InterviewQuestion,ProjectKind} from '../types';
const opts=(items:string[])=>items.map(label=>({label}));
const base:InterviewQuestion[]=[
 {id:'idea',title:'你准备做一个什么项目？',description:'先用自己的话描述目标，之后可以随时修改。',type:'textarea',category:'项目描述',required:true},
 {id:'goal',title:'你为什么想做这个项目？',type:'multi-choice',category:'项目目标',required:true,options:opts(['学习和练手','完成课程 / 比赛','自己使用','给客户交付','自动化现有工作','创业 MVP','商业产品','正式生产环境','其他'])},
 {id:'stage',title:'你希望最终做到什么程度？',type:'single-choice',category:'完成程度',required:true,options:[['概念验证','验证核心想法是否可行'],['Demo','核心功能可以运行'],['可用产品','可以给真实用户使用'],['商业 MVP','可以给第一批付费用户使用'],['正式产品','可以稳定长期运营'],['生产级','考虑安全、性能、监控与扩展']].map(([label,description])=>({label,description}))},
 {id:'audience',title:'这个项目主要给谁使用？',type:'multi-choice',category:'目标用户',required:true,options:opts(['自己','学生','开发者','内容创作者','普通消费者','企业','客户','海外用户','国内用户','其他'])},
 {id:'deliverables',title:'你最终希望得到哪些交付物？',type:'multi-choice',category:'交付物',required:true,options:opts(['网站','Web App','手机 App','桌面应用','AI Agent','API','自动化工作流','CAD 模型','PCB','视频','文档','源代码','可运行程序','部署环境'])},
 {id:'priority',title:'做这个项目时，你最看重什么？',description:'使用上下按钮调整优先级。',type:'ranking',category:'优先级',required:true,options:opts(['最终效果','开发速度','成本','自动化程度','稳定性','易维护','可扩展','UI / UX'])},
 {id:'resources',title:'目前你已经有哪些资源？',type:'multi-choice',category:'已有资源',options:opts(['什么都没有','已有需求','现有代码','GitHub 项目','UI 设计稿','参考网站','CAD 文件','PCB 文件','API','数据集','文档','视频素材'])},
 {id:'timeline',title:'你希望多久完成？',type:'single-choice',category:'周期',required:true,options:opts(['今天','1–3 天','1 周','2 周','1 个月','无严格期限'])},
 {id:'strategy',title:'你更希望采用哪种开发策略？',type:'single-choice',category:'成本策略',required:true,options:[['效果优先','可以使用更多 Token 和更强模型。'],['平衡模式','质量、速度、成本平衡。'],['成本优先','尽量减少模型和 API 成本。']].map(([label,description])=>({label,description}))},
 {id:'participation',title:'你愿意参与多少？',type:'single-choice',category:'人工参与',required:true,options:opts(['尽量全自动','关键节点确认','人机协作','深度参与'])},
 {id:'acceptance',title:'做到什么样，你才会认为这个项目真正完成了？',description:'写下最重要的验收标准，AI 会把它整理成可执行清单。',type:'textarea',category:'验收标准',required:true}
];
const yes=opts(['需要','不需要','还不确定']);
const dynamic:Record<ProjectKind,InterviewQuestion[]>={
 video:['视频素材从哪里来？','是否需要自动剪辑？','是否需要字幕？','是否需要 AI 配音？','是否需要自动发布？'].map((title,i)=>({id:`video-${i}`,title,type:'single-choice',category:'视频能力',dynamic:'video',options:yes})),
 cad:['是否需要真实制造？','使用 3D 打印 / CNC / 注塑？','是否已经有尺寸？','是否需要工程图？','最终需要 STEP / STL / SLDPRT？'].map((title,i)=>({id:`cad-${i}`,title,type:'single-choice',category:'CAD 能力',dynamic:'cad',options:yes})),
 pcb:['是否已有原理图？','是否已经确定芯片？','是否需要实际打板？','是否需要 BOM / Gerber？','是否需要 ERC / DRC？'].map((title,i)=>({id:`pcb-${i}`,title,type:'single-choice',category:'PCB 能力',dynamic:'pcb',options:yes})),
 web:['是否需要账号系统？','是否需要支付？','是否有后台？','是否需要 SEO？','是否需要移动端适配？'].map((title,i)=>({id:`web-${i}`,title,type:'single-choice',category:'Web 能力',dynamic:'web',options:yes})),
 automation:['需要连接哪些应用？','工作流由什么事件触发？','失败时如何处理？'].map((title,i)=>({id:`automation-${i}`,title,type:'text',category:'自动化能力',dynamic:'automation'})),general:[]};
export function detectProjectKind(idea:string):ProjectKind{const s=idea.toLowerCase();if(/视频|tiktok|剪辑|短视频|ffmpeg/.test(s))return'video';if(/solidworks|cad|建模|3d打印|cnc/.test(s))return'cad';if(/pcb|电路板|原理图|gerber|stm32/.test(s))return'pcb';if(/网站|saas|web|网页|平台/.test(s))return'web';if(/自动化|工作流|邮件|n8n|workflow/.test(s))return'automation';return'general'}
export function getQuestions(kind:ProjectKind){return[...base,...dynamic[kind]]}
