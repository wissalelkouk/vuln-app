// TP10 : version corrigée de vuln-app.
const express = require("express");
const rateLimit = require("express-rate-limit");
const { execFile } = require("child_process");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const _ = require("lodash");
const config = require("./config");

const app = express();
app.use(express.json());
app.use(rateLimit({ windowMs: 60 * 1000, limit: 60 }));

const db = new sqlite3.Database(":memory:");
db.serialize(() => {
  db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, role TEXT)");
  db.run("INSERT INTO users (name, role) VALUES ('alice', 'admin'), ('bob', 'user')");
});

// Injection SQL corrigée : requête paramétrée.
app.get("/users", (req, res) => {
  const sql = "SELECT id, name FROM users WHERE name = ?";
  db.all(sql, [req.query.name], (err, rows) =>
    err ? res.status(500).send("Erreur serveur") : res.json(rows)
  );
});

// Injection de commande corrigée : execFile + validation de l'hôte.
app.get("/ping", (req, res) => {
  const host = String(req.query.host || "");
  if (!/^[A-Za-z0-9.-]{1,253}$/.test(host) || host.startsWith("-")) {
    return res.status(400).send("host invalide");
  }
  execFile("ping", ["-c", "1", host], (err, stdout) =>
    res.type("text").send(stdout || String(err))
  );
});

// XSS corrigé : réponse JSON.
app.get("/hello", (req, res) => {
  res.json({ message: `Bonjour ${req.query.name}` });
});

// Prototype pollution : lodash mis à jour.
app.post("/settings", (req, res) => {
  const settings = _.merge({}, req.body);
  res.json(settings);
});

// JWT : secret depuis l'environnement, expiration 1 h.
app.post("/login", (req, res) => {
  const token = jwt.sign({ user: req.body.user, role: "user" }, config.jwt_secret, { expiresIn: "1h" });
  res.json({ token });
});

app.listen(config.port, () => console.log(`vuln-app écoute sur ${config.port}`));
