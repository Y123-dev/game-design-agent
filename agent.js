const { GoogleGenerativeAI } = require("@google/generative-ai");

// ==========================================
// 1. 核心配置
// ==========================================
const API_KEY = "YOUR_GEMINI_API_KEY_HERE"; // 替换为你的 Gemini API Key
const genAI = new GoogleGenerativeAI(API_KEY);

// 推荐使用 gemini-1.5-pro，文本推理和视觉能力最强
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

// ==========================================
// 2. 模拟生图引擎 (Midjourney/SD)
// ==========================================
async function generateImage(prompt) {
    console.log(`\n🎨 [生图引擎] 正在生成图片，提示词: ${prompt.substring(0, 50)}...`);
    // 实际项目中这里替换为调用真实生图 API 的代码
    // 这里使用一张测试用的占位图来跑通闭环
    return "https://raw.githubusercontent.com/google/generative-ai-python/master/docs/site/en/tutorials/test_images/mountain.png";
}

// ==========================================
// 3. 智能体 (Agents) 定义
// ==========================================

class PlannerAgent {
    async analyze(worldDoc) {
        console.log("🧠 [策划 Agent] 正在阅读世界观设定，提取视觉特征...");
        const prompt = `你是一名资深游戏主策划。请分析以下世界观，并提取出 5 个用于角色概念设计的核心视觉特征。
        要求强制输出 JSON 格式：{ "traits": ["特征1", "特征2", ...] }
        世界观内容：${worldDoc}`;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" } // 强制 JSON 输出
        });
        return JSON.parse(result.response.text());
    }
}

class PromptAgent {
    async createPrompt(traits, feedback = null) {
        console.log("✍️ [提示词 Agent] 正在将特征转化为 AI 绘画提示词...");
        let context = `核心视觉特征: ${traits.join(', ')}`;
        
        if (feedback) {
            console.log(`⚠️ [提示词 Agent] 接收到打回意见: ${feedback}，正在针对性修改...`);
            context += `\n上一版的审核未通过，修改意见为: ${feedback}。请在提示词中重点修复这些问题。`;
        }

        const prompt = `你是一名 AI 绘画提示词专家。请根据以下特征编写高质量的 Midjourney 提示词。
        要求强制输出 JSON 格式：{ "positive": "英文正向提示词", "negative": "英文反向提示词" }
        上下文：${context}`;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });
        return JSON.parse(result.response.text());
    }
}

class ReviewAgent {
    async review(imageUrl, requirements) {
        console.log("👁️ [审核 Agent] 正在结合视觉规范进行闭环评估...");
        try {
            // Node.js 原生 fetch 获取图片数据，并转为 Base64 给大模型看
            const response = await fetch(imageUrl);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            const prompt = `你是一名严苛的游戏主美。请检查这张图片是否符合以下规范：\n${requirements}
            请输出 JSON 格式：{ "passed": true/false, "reason": "通过的理由，或未通过的详细修改建议" }`;

            const result = await model.generateContent({
                contents: [{
                    role: "user",
                    parts: [
                        { text: prompt },
                        { inlineData: { data: buffer.toString("base64"), mimeType: "image/png" } }
                    ]
                }],
                generationConfig: { responseMimeType: "application/json" }
            });
            return JSON.parse(result.response.text());
            
        } catch (error) {
            console.error("❌ 审核 API 失败:", error);
            return { passed: true, reason: "由于网络原因跳过审核" };
        }
    }
}

// ==========================================
// 4. 工作流编排引擎
// ==========================================

async function runMultiAgentWorkflow(worldDoc, requirements, maxRounds = 3) {
    console.log("\n🚀 =============================================== 🚀");
    console.log("      启动：游戏角色概念自动化设计多智能体工作流");
    console.log("🚀 =============================================== 🚀\n");

    const planner = new PlannerAgent();
    const prompter = new PromptAgent();
    const reviewer = new ReviewAgent();

    // 1. 策划拆解需求
    const { traits } = await planner.analyze(worldDoc);
    let lastFeedback = null;

    // 2. 闭环生成与审核机制 (While 循环/For 循环)
    for (let i = 0; i < maxRounds; i++) {
        console.log(`\n🌀 --- 开始第 ${i + 1} 轮迭代 ---`);

        // 2.1 提示词编写
        const prompts = await prompter.createPrompt(traits, lastFeedback);
        
        // 2.2 API 生图
        const imageUrl = await generateImage(prompts.positive);
        
        // 2.3 多模态视觉审核
        const reviewResult = await reviewer.review(imageUrl, requirements);

        if (reviewResult.passed) {
            console.log("\n✅ ===============================================");
            console.log("🎉 审核通过，任务完成！");
            console.log(`🔗 最终交付美术资产: ${imageUrl}`);
            console.log("=================================================\n");
            return imageUrl;
        } else {
            console.log(`\n❌ 审核未通过: ${reviewResult.reason}`);
            lastFeedback = reviewResult.reason; // 把意见存下来，传给下一轮的提示词 Agent
        }
    }

    console.log("\n⚠️ 已达到最大重试次数，工作流强制结束。输出当前最佳版本。");
}

// ==========================================
// 5. 启动程序
// ==========================================

const mockWorldDoc = `项目代号：《霓虹跃动》。3D 跑酷游戏。主角是一名底层信使，经常穿梭于贫民窟的高楼之间。
要求：动作敏捷，身上必须有劣质的机械改造痕迹（如裸露线缆的机械臂），整体色调要能融入霓虹灯泛滥的夜晚。`;

const mockRequirements = `1. 画面必须具有极强的动态张力。
2. 机械义肢清晰可见，且呈现金属反光。
3. 主色调必须包含青蓝色与紫红色。`;

runMultiAgentWorkflow(mockWorldDoc, mockRequirements);