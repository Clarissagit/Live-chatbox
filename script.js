// ============ DOM references (same IDs as index.html) ============
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const chatArea = document.getElementById("chat-area");

// ============ Bot memory ============
const memory = {
  name: null,        // user's name, if they told us
  messageCount: 0    // how many messages the user has sent
};

// ============ Small helpers ============
function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function tidy(n) {
  return Math.round(n * 1e6) / 1e6; // avoid 0.30000000000000004
}

function withName(text) {
  return memory.name ? text + ", " + memory.name : text;
}

// ============ Create a message and append it to the chat area ============
function addMessage(text, type) {
  const msg = document.createElement("div");
  msg.classList.add("message", type);

  const p = document.createElement("p");
  p.textContent = text;            // textContent prevents HTML injection
  p.style.whiteSpace = "pre-line"; // lets "\n" show as a new line

  const time = document.createElement("span");
  time.classList.add("time");
  time.textContent = getTime();

  msg.appendChild(p);
  msg.appendChild(time);
  chatArea.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;
  return msg;
}

// ============ Maths engine (no eval, uses a tiny parser) ============
function parseExpression(src) {
  let pos = 0;
  const s = src.replace(/\s+/g, "");

  function number() {
    const m = s.slice(pos).match(/^\d+(\.\d+)?/);
    if (!m) throw new Error("bad number");
    pos += m[0].length;
    return parseFloat(m[0]);
  }

  function factor() {
    if (s[pos] === "-") { pos++; return -factor(); }
    if (s[pos] === "+") { pos++; return factor(); }
    if (s[pos] === "(") {
      pos++;
      const v = addSub();
      if (s[pos] !== ")") throw new Error("missing )");
      pos++;
      return v;
    }
    return number();
  }

  function power() {
    const base = factor();
    if (s[pos] === "^") { pos++; return Math.pow(base, power()); }
    return base;
  }

  function mulDiv() {
    let v = power();
    while (s[pos] === "*" || s[pos] === "/" || s[pos] === "%") {
      const op = s[pos++];
      const r = power();
      if ((op === "/" || op === "%") && r === 0) throw new Error("divide by zero");
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  }

  function addSub() {
    let v = mulDiv();
    while (s[pos] === "+" || s[pos] === "-") {
      const op = s[pos++];
      const r = mulDiv();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  const result = addSub();
  if (pos !== s.length) throw new Error("unexpected input");
  return result;
}

function tryMath(raw) {
  let t = raw.toLowerCase();

  // Don't treat dates like 16-10-2026 as subtraction
  if (/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(t)) return null;

  // Percentage: "20% of 150" / "20 percent of 150"
  let m = t.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)\s*of\s*(\d+(?:\.\d+)?)/);
  if (m) {
    return m[1] + "% of " + m[2] + " is " + tidy((parseFloat(m[1]) / 100) * parseFloat(m[2])) + ".";
  }

  // Square root / cube / square
  m = t.match(/(?:square root of|sqrt of|sqrt)\s*(\d+(?:\.\d+)?)/);
  if (m) return "The square root of " + m[1] + " is " + tidy(Math.sqrt(parseFloat(m[1]))) + ".";

  m = t.match(/square of\s*(\d+(?:\.\d+)?)/);
  if (m) return m[1] + " squared is " + tidy(Math.pow(parseFloat(m[1]), 2)) + ".";

  m = t.match(/cube of\s*(\d+(?:\.\d+)?)/);
  if (m) return m[1] + " cubed is " + tidy(Math.pow(parseFloat(m[1]), 3)) + ".";

  // Words -> symbols
  t = t
    .replace(/multiplied by|times|\binto\b/g, "*")
    .replace(/divided by|\bover\b/g, "/")
    .replace(/to the power of|power/g, "^")
    .replace(/\bplus\b|\band\b(?=\s*\d)/g, "+")
    .replace(/\bminus\b|\bless\b/g, "-")
    .replace(/\bmod\b|\bmodulo\b/g, "%")
    .replace(/(\d)\s*x\s*(\d)/g, "$1*$2")
    .replace(/×/g, "*")
    .replace(/÷/g, "/");

  // Find runs made only of digits and operators
  const runs = t.match(/[\d.()+\-*/%^\s]{3,}/g);
  if (!runs) return null;

  for (let i = 0; i < runs.length; i++) {
    const expr = runs[i].trim();
    if (!/\d/.test(expr) || !/[+\-*/%^]/.test(expr.replace(/^-/, ""))) continue;
    try {
      const value = parseExpression(expr);
      if (!isFinite(value)) return "That result is too large for me.";
      return expr.replace(/\s+/g, " ") + " = " + tidy(value);
    } catch (e) {
      if (e.message === "divide by zero") return "I can't divide by zero.";
      // not valid maths, try the next run
    }
  }
  return null;
}

// ============ Remember the user's name ============
function tryName(raw) {
  let m = raw.match(/(?:my name is|call me|i am called|i'm called)\s+([a-zA-Z]+)/i);
  if (m) {
    memory.name = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    return "Nice to meet you, " + memory.name + "! What would you like to know?";
  }
  if (/what('?s| is) my name|do you know my name|who am i/i.test(raw)) {
    return memory.name
      ? "Your name is " + memory.name + "."
      : "I don't know it yet. Tell me with \"My name is ...\".";
  }
  return null;
}

// ============ Knowledge: jokes, facts, web topics ============
const jokes = [
  "Why do programmers prefer dark mode? Because light attracts bugs!",
  "Why was the JavaScript developer sad? He didn't know how to Node his feelings.",
  "There are 10 kinds of people: those who understand binary and those who don't.",
  "A CSS developer walks into a bar and immediately wants to centre everything."
];

const topics = [
  { test: /\bhtml\b/,
    answer: "HTML (HyperText Markup Language) gives a web page its structure using elements such as <header>, <form>, <input> and <button>." },
  { test: /\bcss\b/,
    answer: "CSS styles the page: colours, fonts, spacing and layout. Flexbox, Grid and media queries are the main tools for responsive design." },
  { test: /javascript|\bjs\b/,
    answer: "JavaScript adds behaviour to a page. It can respond to events, change the DOM, validate forms and fetch data from servers." },
  { test: /\bdom\b|document object model/,
    answer: "The DOM is the browser's tree-like model of your HTML. JavaScript can select, create, change and remove its nodes using getElementById(), createElement(), appendChild() and so on." },
  { test: /\bevents?\b|addeventlistener/,
    answer: "An event is something that happens on the page, like a click, keypress or form submit. You react to it with element.addEventListener(\"click\", handler)." },
  { test: /media quer/,
    answer: "A media query applies CSS only when a condition is met, e.g. @media (max-width: 600px) { ... } styles the page for phones." },
  { test: /responsive/,
    answer: "Responsive design makes a site adapt to any screen using flexible layouts, relative units, the viewport meta tag and media queries." },
  { test: /closure/,
    answer: "A closure is a function that remembers the variables of the scope where it was created, even after that outer function has returned." },
  { test: /\bscope\b/,
    answer: "Scope decides where a variable is visible. JavaScript has global, function and block scope (let and const are block-scoped)." },
  { test: /\bfunctions?\b/,
    answer: "A function is a reusable block of code, e.g. function add(a, b) { return a + b; }" },
  { test: /\barray/,
    answer: "An array stores an ordered list of values, e.g. let nums = [1, 2, 3]; Useful methods: push, pop, map, filter, forEach." },
  { test: /\bflexbox\b|\bflex\b/,
    answer: "Flexbox is a CSS layout model for arranging items in a row or column. Key properties: display: flex, justify-content, align-items and gap." },
  { test: /viewport/,
    answer: "The viewport meta tag, <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">, tells mobile browsers to use the real device width so media queries work properly." }
];

// ============ Conversation rules (checked in order) ============
const rules = [
  { test: /\b(hello|hi|hie|hii|hey|namaste)\b|good (morning|afternoon|evening)/,
    reply: function () {
      return pick([
        withName("Hello") + "! How can I help?",
        withName("Hi") + "! Ask me anything on my list, or type \"help\"."
      ]);
    } },

  { test: /how are you|how('?s| is) it going/,
    reply: function () { return "I'm doing well, thanks! How about you?"; } },

  { test: /\bi('?m| am) (fine|good|great|okay|ok|well|happy)\b/,
    reply: function () { return "Glad to hear it! What shall we do next?"; } },

  { test: /\bi('?m| am) (sad|tired|bored|upset|stressed|angry)\b/,
    reply: function () { return "Sorry to hear that. Want a joke to cheer you up? Just ask!"; } },

  { test: /your name|who are you|what are you/,
    reply: function () { return "I'm Chat Bot, a small rule-based bot built with HTML, CSS and JavaScript for a web design lab."; } },

  { test: /who (made|created|built) you/,
    reply: function () { return "I was built as a lab experiment using plain JavaScript, DOM manipulation and event handling."; } },

  { test: /what can you do|\bhelp\b|\bcommands?\b/,
    reply: function () {
      return "Here is what I can do:\n" +
        "- Maths: 25 * 4, (3 + 5) ^ 2, 20% of 150, square root of 81\n" +
        "- Time, date and day\n" +
        "- Jokes\n" +
        "- Web topics: HTML, CSS, JavaScript, DOM, events, media queries, flexbox\n" +
        "- Remember your name: say \"My name is ...\"";
    } },

  { test: /\btime\b/,
    reply: function () {
      return "It's " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " right now.";
    } },

  { test: /\b(date|day)\b.*\b(date|day)\b|what day|today'?s day/,
    reply: function () {
      return "Today is " + new Date().toLocaleDateString("en-IN", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
      }) + ".";
    } },

  { test: /\bdate\b/,
    reply: function () {
      return "Today's date is " + new Date().toLocaleDateString("en-IN", {
        day: "numeric", month: "long", year: "numeric"
      }) + ".";
    } },

  { test: /\bday\b/,
    reply: function () {
      return "Today is " + new Date().toLocaleDateString("en-IN", { weekday: "long" }) + ".";
    } },

  { test: /\b(month)\b/,
    reply: function () {
      return "The current month is " + new Date().toLocaleDateString("en-IN", { month: "long" }) + ".";
    } },

  { test: /\byear\b/,
    reply: function () { return "The year is " + new Date().getFullYear() + "."; } },

  { test: /\bjokes?\b|make me laugh|something funny/,
    reply: function () { return pick(jokes); } },

  { test: /\bweather\b/,
    reply: function () { return "I'm not connected to any weather service, so I can't tell you that. A weather app will be more accurate."; } },

  { test: /thank(s| you)|\bthx\b/,
    reply: function () { return pick(["You're welcome!", "Happy to help!", "Anytime!"]); } },

  { test: /\bbye\b|goodbye|see you|good night/,
    reply: function () { return withName("Goodbye") + "! Have a great day."; } }
];

// ============ Decide the reply ============
function getBotReply(userText) {
  const lower = userText.toLowerCase();

  // 1. Name memory (so "my name is 5" style input doesn't hit maths first)
  const nameReply = tryName(userText);
  if (nameReply) return nameReply;

  // 2. Maths
  const mathReply = tryMath(userText);
  if (mathReply) return mathReply;

  // 3. Conversation rules
  for (let i = 0; i < rules.length; i++) {
    if (rules[i].test.test(lower)) return rules[i].reply();
  }

  // 4. Web topics
  for (let i = 0; i < topics.length; i++) {
    if (topics[i].test.test(lower)) return topics[i].answer;
  }

  // 5. Fallback
  const hint = memory.messageCount > 3
    ? "Type \"help\" to see everything I can do."
    : "Try a maths problem, the time, a joke, or a web topic like CSS.";
  return pick([
    "I'm not sure I understood that. " + hint,
    "Sorry, I don't know that one yet. " + hint
  ]);
}

// ============ Send the bot's reply with a "typing" bubble ============
function sendBotReply(userText) {
  const typing = addMessage("typing...", "received");
  typing.style.opacity = "0.6";
  typing.querySelector("p").style.fontStyle = "italic";

  setTimeout(function () {
    typing.remove();
    addMessage(getBotReply(userText), "received");
  }, 500 + Math.random() * 500);
}

// ============ Handle the submit event (Send button or Enter key) ============
chatForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const text = messageInput.value.trim();
  if (text === "") return;

  memory.messageCount++;
  addMessage(text, "sent");
  messageInput.value = "";
  messageInput.focus();

  sendBotReply(text);
});
