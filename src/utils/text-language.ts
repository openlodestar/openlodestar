// src/utils/text-language.ts
/**
 * 语言类判定与字形折叠（纯函数，全仓唯一定义点）
 *
 * 解决两个问题：
 * 1. **语言类判定**：给搜索调用选对地区参数（中文查询打英文站会被地区偏好带偏）；
 * 2. **字形折叠**：把繁体/异体字折成简体正体，使"页面繁体、引文简体"不再被判成
 *    "引文在页面上找不到"，使同一件事的繁简两种写法不再拆成两个比较键。
 *
 * 两条纪律：
 * - **只折字形，不动语义**：不做翻译、不做同义合并、不做模糊相似度匹配；
 * - **是"语言桶"不是"语种"**：政策只留英文类 en / 中文类 zh 两个桶，桶里装了什么
 *   真实语种系统不关心，下游不得把返回值当"这段文本是英文/中文"来用。
 *
 */

/** 语言桶：英文类（含欧洲与印欧语系）/ 中文类（含港澳台繁体与东亚语言） */
export type LanguageClass = 'en' | 'zh';

/** 最短可投票的有效字符数：低于此值不投票（避免 "Sotheby's" 这类短名被硬判） */
const MIN_VOTE_CHARS = 8;

/** 越南语专属字符（拉丁书写）：政策规定越南语进中文类，不靠它会被误判成英文类 */
const VIETNAMESE_MARKERS = /[ăâđêôơưĂÂĐÊÔƠƯ]/;

/** 汉字（含扩展 A）+ 日文假名 + 韩文谚文 */
const HAN_KANA_HANGUL = /[\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;

/** 字母文字：拉丁（含扩展）、西里尔、希腊 */
const LETTERS = /[A-Za-z\u00C0-\u024F\u0400-\u04FF\u0370-\u03FF]/;

/** 统计"有效字符"数与中文类字符数（汉字/假名/谚文），其余字母不作区分 */
function scan(text: string): { effective: number; cjk: number; vietnamese: boolean } {
  let effective = 0;
  let cjk = 0;
  let vietnamese = false;
  for (const ch of text) {
    if (VIETNAMESE_MARKERS.test(ch)) vietnamese = true;
    if (HAN_KANA_HANGUL.test(ch)) {
      effective += 1;
      cjk += 1;
    } else if (LETTERS.test(ch)) {
      effective += 1;
    }
  }
  return { effective, cjk, vietnamese };
}

/**
 * 单段文本 → 语言桶；判不出返回 null（宁缺毋滥）。
 *
 * 判定规则（默认值，逐条可改）：
 * 1. 有效字符少于 8 → 不投票（返回 null）；
 * 2. 命中越南语专属字符 → 中文类；
 * 3. 含汉字、假名、谚文 → 中文类；
 * 4. 其余字母文字 → 英文类。
 */
export function detectLanguageClass(text: string): LanguageClass | null {
  if (typeof text !== 'string') return null;
  const { effective, cjk, vietnamese } = scan(text);
  if (effective < MIN_VOTE_CHARS) return null;
  if (vietnamese) return 'zh';
  if (cjk > 0) return 'zh';
  return 'en';
}

/** 多段文本 → 众数语言桶；平票或全部判不出返回 null */
export function dominantLanguageClass(texts: readonly string[]): LanguageClass | null {
  let en = 0;
  let zh = 0;
  for (const text of texts) {
    const cls = detectLanguageClass(text);
    if (cls === 'en') en += 1;
    else if (cls === 'zh') zh += 1;
  }
  if (en === zh) return null;
  return en > zh ? 'en' : 'zh';
}

/** 语言桶 → 搜索地区参数（hl）；null 走默认值 zh-cn */
export function toSearchHl(cls: LanguageClass | null): 'en' | 'zh-cn' {
  return cls === 'en' ? 'en' : 'zh-cn';
}

/**
 * 输入语言锚：用户用什么语言描述（采集入口取用户原文、
 * 报告再生成取提问原文），生成类产物就用什么语言落字。
 *
 * 与检索用的语言类判定共用同一套判据，差别只在"判不出时兜到哪"：检索判不出
 * 退回沿用行为（zh-cn），而语言锚必须落定一个值——报告不能"无语言"，故缺文本、
 * 文本过短、判不出时一律取中文类（本项目主场景是中文提问）。
 *
 */
export function resolveInputLocale(text: string | null | undefined): LanguageClass {
  return (typeof text === 'string' ? detectLanguageClass(text) : null) ?? 'zh';
}

// ============================================
// 字形折叠：繁体/异体 → 简体正体（只动字形，不动语义）
// ============================================
//
// 离线内置对照表（不依赖外部转换库的既定退路）。
// 未覆盖的字不折叠，表现为该字上少一次命中（如实降级，不造假、不退化为模糊匹配）。
// 表覆盖古玩与拍卖常用字 + 通用高频繁体字。

/**
 * 繁简对照表：每两个字符为一组（繁体 → 简体），共用一个字符串便于紧凑维护。
 * 覆盖通用高频繁体字 + 古玩与拍卖常用字（青花/纏枝蓮紋/窯/釉/專場/機構/蘇富比/佳士得…）。
 *
 * 一字多义的"歧义字"**故意不收**（如 乾：乾隆(qián) 不能折成"干隆"，
 * 而 乾(gān, 干燥) 才作干）——宁可少折一次，也不能把专名改坏（只折字形、不动语义）。
 */
const GLYPH_PAIRS =
  '個个們们來来這这為为說说時时會会對对開开關关學学國国與与內内於于隻只餘余兩两茲兹過过還还進进種种樣样麼么發发電电車车門门馬马鳥鸟魚鱼龍龙鳳凤龜龟點点東东絲丝樂乐買买賣卖讀读書书語语話话錢钱銀银鐵铁銅铜錯错長长問问間间聞闻陽阳陰阴隊队階阶際际險险隨随難难雙双雜杂離离雲云韓韩響响頭头願愿類类顧顾顯显風风飛飞飯饭飲饮館馆駐驻駕驾騎骑驗验體体髮发鬥斗鹹咸麗丽黃黄齊齐舊旧節节藝艺號号處处補补裝装製制複复覺觉觀观見见親亲覽览規规視视認认讓让議议護护訊讯記记詞词譯译試试詳详誌志誠诚誤误誰谁調调談谈請请講讲謝谢證证識识譜谱變变讚赞財财貨货質质購购費费資资賞赏贏赢賺赚賽赛贈赠跡迹較较載载輪轮輸输軸轴軌轨軒轩軟软輝辉輩辈遲迟適适選选遷迁遺遗邁迈邊边邏逻郵邮鄉乡醬酱醫医釋释裡里農农遞递遙遥遠远達达違违運运連连週周遊游鄰邻採采鐘钟鑼锣閉闭閏闰闊阔闆板隱隐雖虽顆颗飄飘饋馈餓饿驚惊驛驿鮮鲜鯉鲤鳴鸣鴻鸿鵬鹏鷹鹰鹽盐麥麦黨党齒齿臉脸腦脑腸肠臟脏膽胆膚肤腎肾腫肿脹胀脈脉膿脓癬癣癢痒瘋疯癲癫癱瘫瘓痪癟瘪癩癞疊叠壘垒壩坝墳坟墊垫塵尘壟垄壯壮聲声殼壳壺壶備备復复儉俭債债傾倾僥侥僱雇價价儀仪億亿儈侩儘尽償偿優优儲储兒儿兌兑蘭兰凜凛劍剑劉刘嘗尝纏缠蓮莲賞赏瓶瓶款款隆隆青青花花胭胭脂脂紅红彩彩紋纹枝枝球球篆篆窯窑瓣瓣劃划泉泉釉釉刻刻碗碗瓷瓷器器專专場场機机構构賣卖國国蘇苏富富藝艺軒轩聖圣貿贸貴贵藏藏鑑鉴錄录圖图冊册頁页張张編编標标註注繪绘畫画織织繡绣錦锦綢绸緞缎羅罗紗纱絨绒氈毡毯毯縫缝納纳維维純纯絕绝綠绿紫紫藍蓝灰灰褐褐棕棕墨墨碧碧翠翠翡翡琥琥瑪玛瑙瑙珠珠貝贝釵钗鐲镯環环鏈链鑽钻琺珐瑯琅鉤钩鈕钮釘钉銳锐剛刚創创劇剧勝胜勳勋勵励勸劝動动務务勞劳勢势勁劲區区協协單单博博嚴严叢丛曆历廁厕廠厂廳厅厲厉壓压厭厌參参嘆叹囑嘱嚀咛團团園园圍围圓圆壤壤徹彻徑径徐徐從从恆恒懇恳態态慌慌慘惨慶庆憐怜憑凭懲惩懺忏懶懒懷怀懸悬懼惧攝摄攤摊攔拦攏拢攙搀攜携斂敛斷断暢畅術术';

/** 繁体字 → 简体字映射（从两字一组解析，避免并行串错位） */
const GLYPH_MAP: ReadonlyMap<string, string> = (() => {
  const chars = [...GLYPH_PAIRS];
  const map = new Map<string, string>();
  for (let i = 0; i + 1 < chars.length; i += 2) {
    const key = chars[i]!;
    const value = chars[i + 1]!;
    if (key !== value) map.set(key, value);
  }
  return map;
})();

/**
 * 字形折叠：繁体/异体字 → 简体正体；只动字形，不动语义。
 * 表未覆盖的字原样保留（如实降级）。
 */
export function foldGlyphVariants(text: string): string {
  if (typeof text !== 'string' || text === '') return text;
  let out = '';
  for (const ch of text) out += GLYPH_MAP.get(ch) ?? ch;
  return out;
}

/** 供折叠覆盖率统计用：给定字符是否在对照表内 */
export function isFoldedGlyph(ch: string): boolean {
  return GLYPH_MAP.has(ch);
}
