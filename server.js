import express from "express";
import cors from "cors";
import fs from "fs-extra";
import { Telegraf } from "telegraf";

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || "";               // <-- tu token de BotFather
const TELEGRAM_ADMIN_ID = Number(process.env.TELEGRAM_ADMIN_ID || 0); // <-- tu user id
const STORAGE_FILE = "./states.json";

if (!BOT_TOKEN) {
  console.error("Falta BOT_TOKEN");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Helpers
function pad3(n) { return n.toString().padStart(3, "0"); }
async function initStorage() {
  if (!await fs.pathExists(STORAGE_FILE)) {
    await fs.writeJson(STORAGE_FILE, { ocupados: [] }, { spaces: 2 });
  }
}
async function loadStore() { await initStorage(); return fs.readJson(STORAGE_FILE); }
async function saveStore(data) { return fs.writeJson(STORAGE_FILE, data, { spaces: 2 }); }
function onlyAdmin(ctx) {
  const uid = ctx.from?.id;
  if (TELEGRAM_ADMIN_ID && uid !== TELEGRAM_ADMIN_ID) {
    ctx.reply("⛔ No autorizado.");
    return false;
  }
  return true;
}

// Commands
bot.start(async (ctx) => {
  console.log("START from:", ctx.from); // si no sabés tu id, miralo en logs
  await ctx.reply("¡Hola! Este es tu bot de números.\nUsá /help para ver comandos.");
});

bot.help(async (ctx) => {
  await ctx.reply(
`Comandos:
/toggle 025  -> Tacha/destacha el número 025
/status 025  -> Muestra si 025 está ocupado o disponible
/lista       -> Lista números ocupados (primeros 200)
/reset       -> Limpia todos los marcados`
  );
});

bot.command("toggle", async (ctx) => {
  if (!onlyAdmin(ctx)) return;
  const arg = (ctx.message.text.split(/\s+/)[1] || "").trim();
  if (!arg) return ctx.reply("Usá: /toggle 025");
  const num = pad3(parseInt(arg, 10));
  if (isNaN(num)) return ctx.reply("Número inválido. Ej: /toggle 025");

  const id = `num-${num}`;
  const store = await loadStore();
  const idx = store.ocupados.indexOf(id);
  if (idx === -1) {
    store.ocupados.push(id);
    await saveStore(store);
    return ctx.reply(`✅ ${num} marcado como OCUPADO.`);
  } else {
    store.ocupados.splice(idx, 1);
    await saveStore(store);
    return ctx.reply(`↩️ ${num} desmarcado (disponible).`);
  }
});

bot.command("status", async (ctx) => {
  if (!onlyAdmin(ctx)) return;
  const arg = (ctx.message.text.split(/\s+/)[1] || "").trim();
  if (!arg) return ctx.reply("Usá: /status 025");
  const num = pad3(parseInt(arg, 10));
  if (isNaN(num)) return ctx.reply("Número inválido. Ej: /status 025");

  const id = `num-${num}`;
  const store = await loadStore();
  const ocupado = store.ocupados.includes(id);
  return ctx.reply(`${num} está ${ocupado ? "OCUPADO" : "DISPONIBLE"}.`);
});

bot.command("lista", async (ctx) => {
  if (!onlyAdmin(ctx)) return;
  const store = await loadStore();
  const nums = store.ocupados.map(id => id.replace("num-", ""));
  const listado = nums.slice(0, 200).join(", ");
  await ctx.reply(`Ocupados (${nums.length}): ${listado || "Ninguno"}`);
});

bot.command("reset", async (ctx) => {
  if (!onlyAdmin(ctx)) return;
  const store = await loadStore();
  store.ocupados = [];
  await saveStore(store);
  await ctx.reply("🔄 Todos los números desmarcados.");
});

// Iniciar bot (long polling)
bot.launch().then(() => console.log("Telegram bot iniciado")).catch(console.error);

// Express para exponer /states.json (para la web)
const app = express();
app.use(cors());

app.get("/states.json", async (req, res) => {
  const data = await loadStore();
  res.set("Cache-Control", "no-store");
  res.json(data);
});

app.get("/", (req, res) => res.send("OK"));
app.listen(PORT, () => console.log("Server on port", PORT));

// Graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
