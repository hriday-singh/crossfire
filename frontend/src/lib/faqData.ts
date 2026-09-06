export interface FaqItem {
  id: string;
  category: "Overview" | "Architecture" | "Comparisons";
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "what-is-crossfire",
    category: "Overview",
    question: "What is Crossfire, in one line?",
    answer:
      "It takes a decision you're about to commit to, breaks it into the claims it depends on, tests the important ones independently, and gives you a verdict per claim: survived, weakened, broken, or unresolved, plus what to do next. Not a chat, not an opinion, a test report.",
  },
  {
    id: "not-just-a-wrapper",
    category: "Architecture",
    question: "Isn't this just a wrapper around an AI model?",
    answer:
      "No. A wrapper is one prompt in, one answer out. Crossfire never lets a single model call answer the question directly. It runs a fixed process: pull out the claims, test the important ones independently (pulling live evidence off the web powered by SerpApi), then a separate step weighs it all and decides. That's a process, not a prompt with a personality on it.",
  },
  {
    id: "serpapi-evidence-retrieval",
    category: "Architecture",
    question: "How does Crossfire search and retrieve real-world evidence?",
    answer:
      "Crossfire is powered by SerpApi for real-time web search and structured evidence retrieval. When adversarial agents test load-bearing assumptions, SerpApi executes real-time queries across Google Search, extracting fresh citations, market figures, and counter-arguments so decisions are grounded in live reality rather than stale LLM hallucinations.",
  },
  {
    id: "better-than-one-model",
    category: "Comparisons",
    question: "How is this better than just using one AI model directly?",
    answer:
      "One model, one voice, one pass. What it checks depends entirely on how you phrased the question. Crossfire forces the same investigation every time: find the claims that matter, test them independently so they can't just agree with each other, back it with real evidence, and hand you a claim-by-claim verdict you can point to. A raw answer gives you none of that structure.",
  },
  {
    id: "not-assistant-or-chatbot",
    category: "Overview",
    question: "How is this not just an AI assistant or chatbot?",
    answer:
      "An assistant chats with you and answers whatever you ask. Crossfire doesn't converse. You give it one decision, it gives you back claims, tests, evidence, and verdicts. No persona, no back and forth. Closer to a test report than a conversation.",
  },
  {
    id: "independent-blind-tests",
    category: "Architecture",
    question: "What stops the different tests from just agreeing with each other?",
    answer:
      "Every test runs blind. Each one forms its own finding without seeing what the others found. Only after all of them are done does a separate step look at everything together and decide. That's what stops it turning into an echo chamber, and it's backed by real research on why AI agents debating each other tend to just agree with each other or dig into their own view.",
  },
  {
    id: "better-than-good-prompt",
    category: "Comparisons",
    question: "How is this better than someone writing a really good prompt themselves?",
    answer:
      "A good prompt is only as good as the person who wrote it, that one time. Ask it differently, or forget to ask about the thing that matters, and you get nothing. Crossfire runs the same process every time regardless: find what actually matters, test it independently, back it with evidence, give a verdict. It doesn't rely on you knowing what to ask.",
  },
  {
    id: "different-from-search-chat",
    category: "Comparisons",
    question: "How is this different from just using Claude or ChatGPT with search turned on?",
    answer:
      "Search-enabled chat still reasons in one continuous thread. Once it finds something that fits the answer it's already building, it tends to keep building on it. Crossfire runs separate, independent checks that can't see each other's results until a final step weighs the evidence, actively looks for what argues against a claim and not just what supports it, and is honest when it genuinely can't tell, unresolved is a real answer, not a cop-out. You get a structured verdict, not a paragraph.",
  },
  {
    id: "different-from-perplexity",
    category: "Comparisons",
    question: "How is this different from a research platform, like Perplexity?",
    answer:
      "A research platform tells you what's out there on a topic. Crossfire tells you whether your specific decision survives. It doesn't just gather information, it decides which claims in your plan actually matter, tests those, and ends with a verdict and a next step, not a report you still have to interpret yourself.",
  },
  {
    id: "different-from-ai-council",
    category: "Comparisons",
    question: "How is this different from an AI council, like The AI Council app?",
    answer:
      "Those tools send your question to several models, let them see and react to each other's answers, then merge everything into one final answer with a single confidence score. That's still one opinion at the end, just an averaged one, and letting the models see each other's answers before merging is exactly what makes them converge and agree instead of catching what the other missed. Crossfire never merges into one answer or one score. It decides which claims your decision actually depends on, tests each one independently with zero visibility into what the others found, and gives you a verdict per claim, survived, weakened, broken, or unresolved, plus what that means for your decision and what to check next. A confidence score tells you how much agreement there was. A verdict tells you what to actually do.",
  },
];
