const WEIGHTS = {
  attackPotency: { label: "Attack potency", weight: 20, description: "Primary damaging output; the wiki tier is shown separately and source qualifiers stay visible." },
  strikingStrength: { label: "Striking strength", weight: 10, description: "Profiled striking force, scored separately from overall attack potency." },
  liftingStrength: { label: "Lifting strength", weight: 5, description: "Physical lifting class/strength, included as a distinct profile stat." },
  speed: { label: "Combat speed", weight: 20, description: "Ability to act, react, and land a meaningful attack before the opponent." },
  durability: { label: "Durability / survival", weight: 15, description: "How well the fighter can survive the opponent's likely attacks, including listed defensive traits." },
  hax: { label: "Abilities / hax", weight: 18, description: "Opponent-relevant special abilities, counters, and documented interaction limits." },
  range: { label: "Range / control", weight: 5, description: "Effective engagement distance and ability to control the battlefield." },
  stamina: { label: "Stamina", weight: 3, description: "Ability to continue fighting without tiring." },
  intelligence: { label: "Intelligence / skill", weight: 4, description: "Planning, tactics, and combat decision-making supported by the profile." }
};

const ARCHIVE_STORAGE_KEY = "versus-archive.matchups.v1";
const ARCHIVE_SCHEMA_VERSION = 1;
const STAT_KEYS = Object.keys(WEIGHTS);
const appState = { characters: [], oneId: "adam-assassins-creed", twoId: "kyogai-demon-slayer", activeView: "matchup", query: "", matchRecords: [] };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function byId(id) { return appState.characters.find(character => character.id === id); }
function selectedFighters() { return [byId(appState.oneId), byId(appState.twoId)]; }
function clamp(value, min = 0, max = 10) { return Math.min(max, Math.max(min, value)); }
function ratingFor(character, stat, settings) {
  let rating = character.ratings[stat] ?? 0;
  if (settings.prep && character.adjustments?.prep?.[stat]) rating += character.adjustments.prep[stat];
  if (settings.arena === "kyogai-home" && character.adjustments?.homeArena?.[stat]) rating += character.adjustments.homeArena[stat];
  return clamp(rating);
}
function getElementMatch(attacker, defender) {
  const attacks = (attacker.elemental?.attacks || []).map(value => value.toLowerCase());
  const weaknesses = (defender.elemental?.weaknesses || []).map(value => value.toLowerCase());
  const resistances = (defender.elemental?.resistances || []).map(value => value.toLowerCase());
  return {
    weaknessHits: attacks.filter(tag => weaknesses.includes(tag)),
    resistanceHits: attacks.filter(tag => resistances.includes(tag))
  };
}
function getSettings() {
  return { arena: $("#arena-select").value, prep: $("#prep-toggle").checked };
}
function fighterScore(character, settings, opponent) {
  const ratings = Object.fromEntries(STAT_KEYS.map(stat => [stat, ratingFor(character, stat, settings)]));
  const weakness = getElementMatch(character, opponent);
  const resistance = getElementMatch(opponent, character);
  if (weakness.weaknessHits.length) ratings.attackPotency = clamp(ratings.attackPotency + 1.5);
  if (weakness.resistanceHits.length) ratings.attackPotency = clamp(ratings.attackPotency - 1.1);
  if (resistance.weaknessHits.length) ratings.durability = clamp(ratings.durability - 1.2);
  if (resistance.resistanceHits.length) ratings.durability = clamp(ratings.durability + 0.6);
  const weighted = STAT_KEYS.reduce((total, stat) => total + ratings[stat] * WEIGHTS[stat].weight, 0) / 10;
  return { ratings, weighted, weakness, resistance };
}
function formatScore(value) { return Number(value).toFixed(1); }
function readSavedMatches() {
  try {
    const saved = JSON.parse(localStorage.getItem(ARCHIVE_STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(record => record && record.id && record.recordedAt && Array.isArray(record.fighters) && record.fighters.length === 2 && record.scores?.weighted && record.verdict) : [];
  } catch (error) {
    console.warn("Could not load local matchup archive", error);
    return [];
  }
}
function writeSavedMatches() {
  try {
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(appState.matchRecords));
    return true;
  } catch (error) {
    console.error("Could not save local matchup archive", error);
    return false;
  }
}
function makeMatchRecord() {
  const [one, two] = selectedFighters();
  const settings = getSettings();
  const scoreOne = fighterScore(one, settings, two);
  const scoreTwo = fighterScore(two, settings, one);
  const verdict = modelVerdict(one, two, scoreOne, scoreTwo, settings);
  const fighterSnapshot = (fighter, scored) => ({
    id: fighter.id,
    name: fighter.name,
    series: fighter.series,
    tier: fighter.tier,
    sourceUrl: fighter.sourceUrl,
    stats: { ...fighter.stats },
    baseRatings: { ...fighter.ratings },
    matchupRatings: { ...scored.ratings },
    weaknesses: [...fighter.weaknesses],
    abilities: [...fighter.abilities]
  });
  return {
    id: globalThis.crypto?.randomUUID?.() || `match-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    recordedAt: new Date().toISOString(),
    modelVersion: "heuristic-v1",
    conditions: {
      arena: settings.arena,
      arenaLabel: $("#arena-select").selectedOptions[0].textContent,
      preparation: settings.prep
    },
    fighters: [fighterSnapshot(one, scoreOne), fighterSnapshot(two, scoreTwo)],
    scores: {
      weighted: [Number(scoreOne.weighted.toFixed(2)), Number(scoreTwo.weighted.toFixed(2))],
      attributes: Object.fromEntries(STAT_KEYS.map(stat => [stat, {
        label: WEIGHTS[stat].label,
        weightPercent: WEIGHTS[stat].weight,
        ratings: [scoreOne.ratings[stat], scoreTwo.ratings[stat]],
        weightedPoints: [scoreOne.ratings[stat] * WEIGHTS[stat].weight / 10, scoreTwo.ratings[stat] * WEIGHTS[stat].weight / 10]
      }]))
    },
    verdict: {
      winnerId: verdict.winner?.id || null,
      winnerName: verdict.winner?.name || null,
      modelEdgePoints: Number(Math.abs(verdict.margin).toFixed(2)),
      displayEdge: verdict.edge,
      isTie: !verdict.winner
    },
    interactions: {
      oneAttacksWeakness: [...scoreOne.weakness.weaknessHits],
      oneHitsResistance: [...scoreOne.weakness.resistanceHits],
      twoAttacksWeakness: [...scoreTwo.weakness.weaknessHits],
      twoHitsResistance: [...scoreTwo.weakness.resistanceHits]
    }
  };
}
function recordCurrentMatch() {
  const record = makeMatchRecord();
  appState.matchRecords.unshift(record);
  const saved = writeSavedMatches();
  renderArchive();
  const button = $("#record-match-button");
  button.textContent = saved ? "✓ MATCH RECORDED" : "⚠ SAVED FOR THIS SESSION";
  button.classList.add("is-recorded");
  window.setTimeout(() => {
    button.textContent = "＋ RECORD MATCHUP";
    button.classList.remove("is-recorded");
  }, 1800);
}
function renderArchive() {
  const records = appState.matchRecords;
  $("#archive-count").textContent = String(records.length).padStart(2, "0");
  $("#archive-total").textContent = String(records.length).padStart(2, "0");
  const list = $("#archive-list");
  if (!records.length) {
    list.innerHTML = '<div class="archive-empty"><span>◷</span><h2>No matchups recorded yet</h2><p>Run a comparison, then choose <b>Record matchup</b> to save a snapshot here.</p><button type="button" class="primary-small" data-go-matchup>GO TO MATCHUP LAB</button></div>';
    return;
  }
  list.innerHTML = records.map((record, index) => {
    const [one, two] = record.fighters;
    const winner = record.verdict.winnerName ? `${escapeHtml(record.verdict.winnerName)} has the model edge` : "No clear model winner";
    const scores = record.scores.weighted.map(value => Number(value).toFixed(1));
    const date = new Date(record.recordedAt);
    const formattedDate = Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    const prepLabel = record.conditions.preparation ? "Prep allowed" : "No prep";
    return `<article class="archive-card"><div class="archive-card-top"><span class="archive-index">MATCH ${String(records.length - index).padStart(3, "0")}</span><time datetime="${escapeHtml(record.recordedAt)}">${escapeHtml(formattedDate)}</time><span class="archive-model">${escapeHtml(record.modelVersion.toUpperCase())}</span></div><div class="archive-versus"><div><small>${escapeHtml(one.series)}</small><b>${escapeHtml(one.name)}</b><span>${escapeHtml(one.tier)} · ${scores[0]} pts</span></div><span class="archive-vs-mark">VS</span><div><small>${escapeHtml(two.series)}</small><b>${escapeHtml(two.name)}</b><span>${escapeHtml(two.tier)} · ${scores[1]} pts</span></div></div><div class="archive-card-bottom"><span class="archive-winner">✦ ${winner}</span><span>${escapeHtml(record.conditions.arenaLabel)} · ${prepLabel}</span></div><details class="archive-detail"><summary>View recorded score breakdown</summary><div class="archive-breakdown">${Object.entries(record.scores.attributes).map(([key, attribute]) => `<div><span>${escapeHtml(attribute.label)} <small>${attribute.weightPercent}%</small></span><b>${Number(attribute.ratings[0]).toFixed(1)}</b><i>·</i><b>${Number(attribute.ratings[1]).toFixed(1)}</b></div>`).join("")}</div><div class="archive-sources"><a href="${escapeHtml(one.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(one.name)} source ↗</a><a href="${escapeHtml(two.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(two.name)} source ↗</a></div></details></article>`;
  }).join("");
}
function exportArchive() {
  const payload = { schemaVersion: ARCHIVE_SCHEMA_VERSION, exportedAt: new Date().toISOString(), records: appState.matchRecords };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `match-archive-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function modelVerdict(one, two, scoreOne, scoreTwo, settings) {
  const margin = scoreOne.weighted - scoreTwo.weighted;
  if (Math.abs(margin) < 0.6) return { winner: null, edge: 50, margin };
  const winner = margin > 0 ? one : two;
  const edge = Math.round(100 / (1 + Math.exp(-Math.abs(margin) * 0.13)));
  return { winner, edge, margin };
}
function updateFighterCard(side, fighter) {
  const prefix = `fighter-${side}`;
  $(`#${prefix}-image`).src = fighter.portrait;
  $(`#${prefix}-image`).alt = fighter.portraitAlt;
  $(`#${prefix}-tier`).textContent = fighter.tier;
  $(`#${prefix}-series`).textContent = fighter.series.toUpperCase();
  $(`#${prefix}-name`).textContent = fighter.name;
  $(`#${prefix}-alias`).textContent = fighter.alias;
  $(`#${prefix}-ap`).textContent = fighter.ratings.attackPotency.toFixed(1);
  $(`#${prefix}-speed`).textContent = fighter.ratings.speed.toFixed(1);
}
function renderSelects() {
  const optionHtml = appState.characters.map(character => `<option value="${escapeHtml(character.id)}">${escapeHtml(character.name)} · ${escapeHtml(character.series)}</option>`).join("");
  for (const side of ["one", "two"]) {
    const select = $(`#fighter-${side}-select`);
    select.innerHTML = optionHtml;
    select.value = appState[`${side}Id`];
  }
}
function renderResult() {
  const [one, two] = selectedFighters();
  if (!one || !two) return;
  const settings = getSettings();
  const scoreOne = fighterScore(one, settings, two);
  const scoreTwo = fighterScore(two, settings, one);
  const verdict = modelVerdict(one, two, scoreOne, scoreTwo, settings);
  const winner = verdict.winner;
  const winnerIsOne = winner?.id === one.id;
  const title = !winner ? "The matchup is too close to call" : `${winner.name} has the model edge`;
  $("#result-title").textContent = title;
  $("#legend-one-name").textContent = one.name;
  $("#legend-two-name").textContent = two.name;
  $("#score-one-total").textContent = formatScore(scoreOne.weighted);
  $("#score-two-total").textContent = formatScore(scoreTwo.weighted);
  $("#winner-edge").textContent = `${Math.abs(verdict.margin).toFixed(1)} PT EDGE`;
  $("#winner-likelihood").textContent = `${verdict.edge}%`;
  $("#likelihood-bar").style.width = `${verdict.edge}%`;
  $("#winner-name").textContent = winner ? winner.name : "No clear winner";
  $("#winner-series").textContent = winner ? winner.series : "Profiles score within the tie threshold";
  $("#winner-summary").textContent = winner
    ? `${winner.name} leads this comparison on weighted profile evidence. The result is a heuristic lean, not an objective or canon outcome.`
    : "The weighted profile ratings are effectively tied. A reliable verdict would need better matchup-specific evidence.";
  const image = $("#winner-image");
  if (winner) {
    image.src = winner.portrait;
    image.alt = winner.portraitAlt;
    image.hidden = false;
  } else {
    image.removeAttribute("src");
    image.alt = "";
    image.hidden = true;
  }
  const rows = STAT_KEYS.map(stat => {
    const left = scoreOne.ratings[stat];
    const right = scoreTwo.ratings[stat];
    return `<div class="score-row"><span class="score-label">${escapeHtml(WEIGHTS[stat].label)}</span><div class="score-bars" aria-label="${escapeHtml(one.name)} ${formatScore(left)} out of 10, ${escapeHtml(two.name)} ${formatScore(right)} out of 10"><div class="score-bar one"><span style="width:${left * 10}%"></span></div><div class="score-bar two"><span style="width:${right * 10}%"></span></div></div><span class="score-pair"><b class="one">${formatScore(left)}</b><b class="two">${formatScore(right)}</b></span></div>`;
  }).join("");
  $("#score-rows").innerHTML = rows;
  renderReasons(one, two, scoreOne, scoreTwo, settings, verdict);
}
function renderReasons(one, two, scoreOne, scoreTwo, settings, verdict) {
  const ordered = STAT_KEYS.map(stat => ({ stat, gap: scoreOne.ratings[stat] - scoreTwo.ratings[stat] })).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  const top = ordered.slice(0, 2).map(({ stat, gap }) => {
    const leader = gap >= 0 ? one : two;
    const first = stat === "attackPotency" ? leader.stats.attackPotency : stat === "strikingStrength" ? leader.stats.strikingStrength : stat === "liftingStrength" ? leader.stats.liftingStrength : stat === "speed" ? leader.stats.speed : stat === "durability" ? leader.stats.durability : stat === "range" ? leader.stats.range : stat === "stamina" ? leader.stats.stamina : stat === "intelligence" ? leader.stats.intelligence : leader.abilities.slice(0, 3).join(", ");
    return { className: "good", kicker: `${WEIGHTS[stat].label.toUpperCase()} · ${leader.name.toUpperCase()}`, title: stat === "speed" && Math.abs(gap) > 2 ? "Initiative advantage" : `${leader.name} leads`, body: `Profile: ${String(first).split(/[;(]/)[0].trim()}.` };
  });
  const elementalMatches = scoreOne.weakness.weaknessHits.length || scoreOne.resistance.resistanceHits.length || scoreTwo.weakness.weaknessHits.length || scoreTwo.resistance.resistanceHits.length;
  const contextual = settings.arena === "kyogai-home"
    ? { className: "warning", kicker: "BATTLEFIELD · HOME ADVANTAGE", title: "Mansion effects enabled", body: "Kyogai's room-control and teleportation ratings rise because his profile ties them to his house." }
    : settings.prep
      ? { className: "warning", kicker: "CONDITIONS · PREPARATION", title: "Prep boosts applied", body: "Only the prep adjustments explicitly recorded in these profiles are included." }
      : elementalMatches
        ? { className: "warning", kicker: "ELEMENTAL INTERACTION", title: "Documented interaction", body: "An attack tag matches a listed weakness or resistance; its small model adjustment is included." }
        : { className: "", kicker: "COUNTERS · RESISTANCES", title: "No confirmed elemental counter", body: "No listed attack matches the opponent's elemental weaknesses or resistances. Kyogai's Demon weaknesses are not assumed to be exploitable by Adam." };
  $("#reasoning-row").innerHTML = [...top, contextual].map(reason => `<article class="reason-card ${reason.className}"><span class="reason-kicker">${escapeHtml(reason.kicker)}</span><b>${escapeHtml(reason.title)}</b><p>${escapeHtml(reason.body)}</p></article>`).join("");
}
function renderRoster() {
  const query = appState.query.trim().toLowerCase();
  const filtered = appState.characters.filter(character => `${character.name} ${character.series} ${character.alias} ${character.tier}`.toLowerCase().includes(query));
  $("#roster-grid").innerHTML = filtered.length ? filtered.map(character => `
    <article class="roster-card">
      <div class="roster-art"><img src="${escapeHtml(character.portrait)}" alt="${escapeHtml(character.portraitAlt)}" loading="lazy" /><span>${escapeHtml(character.tier)}</span></div>
      <div class="roster-body"><span class="series">${escapeHtml(character.series.toUpperCase())}</span><h2>${escapeHtml(character.name)}</h2><p class="alias">${escapeHtml(character.alias)}</p><p>${escapeHtml(character.summary)}</p><div class="roster-tags"><span>AP ${character.ratings.attackPotency.toFixed(1)}</span><span>SPD ${character.ratings.speed.toFixed(1)}</span><span>HAX ${character.ratings.hax.toFixed(1)}</span></div><div class="roster-actions"><button type="button" data-set-fighter="one" data-character-id="${escapeHtml(character.id)}">SET FIGHTER 01</button><button type="button" data-set-fighter="two" data-character-id="${escapeHtml(character.id)}">SET FIGHTER 02</button><button class="view-profile" type="button" data-open-profile="${escapeHtml(character.id)}">PROFILE ↗</button></div></div>
    </article>`).join("") : `<div class="roster-empty">No curated profiles match that search.</div>`;
  $("#roster-caption").textContent = `${filtered.length} MANUALLY IMPORTED PROFILE${filtered.length === 1 ? "" : "S"}`;
  $("#roster-total").textContent = String(appState.characters.length).padStart(2, "0");
}
function renderAll() {
  renderSelects();
  updateFighterCard("one", byId(appState.oneId));
  updateFighterCard("two", byId(appState.twoId));
  renderResult();
  renderRoster();
  renderArchive();
  $("#roster-total").textContent = String(appState.characters.length).padStart(2, "0");
}
function setFighter(side, characterId) {
  const otherSide = side === "one" ? "two" : "one";
  if (appState[`${otherSide}Id`] === characterId) appState[`${otherSide}Id`] = appState[`${side}Id`];
  appState[`${side}Id`] = characterId;
  renderAll();
}
function openProfile(characterId) {
  const character = byId(characterId);
  if (!character) return;
  const stats = Object.entries(character.stats).map(([key, value]) => `<div class="profile-stat"><b>${escapeHtml(key.replace(/([A-Z])/g, " $1").toUpperCase())}</b><span>${escapeHtml(value)}</span></div>`).join("");
  const abilities = character.abilities.map(ability => `<span>${escapeHtml(ability)}</span>`).join("");
  const equipment = character.equipment.map(item => `<span>${escapeHtml(item)}</span>`).join("");
  const weaknesses = character.weaknesses.map(item => `<span class="weakness-chip">${escapeHtml(item)}</span>`).join("");
  const elemental = [...character.elemental.attacks.map(item => `Attack: ${item}`), ...character.elemental.weaknesses.map(item => `Weakness: ${item}`), ...character.elemental.resistances.map(item => `Resistance: ${item}`)];
  $("#dialog-content").innerHTML = `
    <div class="profile-hero"><img src="${escapeHtml(character.portrait)}" alt="${escapeHtml(character.portraitAlt)}" /><div><span class="profile-series">${escapeHtml(character.series.toUpperCase())}</span><h2 id="dialog-name">${escapeHtml(character.name)}</h2><p class="profile-alias">${escapeHtml(character.alias)}</p><span class="tier-badge">TIER ${escapeHtml(character.tier)}</span></div></div>
    <div class="profile-details"><p class="profile-summary">${escapeHtml(character.summary)}</p><section class="profile-section"><h3>VS Battles Wiki profile stats</h3><div class="profile-stat-grid">${stats}</div></section><section class="profile-section"><h3>Abilities</h3><div class="chip-list">${abilities}</div></section><section class="profile-section"><h3>Standard equipment</h3><div class="chip-list">${equipment}</div></section><section class="profile-section"><h3>Weaknesses</h3><div class="chip-list">${weaknesses}</div></section><section class="profile-section"><h3>Elemental interaction tags</h3><div class="chip-list">${elemental.length ? elemental.map(item => `<span class="neutral-chip">${escapeHtml(item)}</span>`).join("") : '<span class="neutral-chip">No specific elemental tags documented</span>'}</div></section><section class="profile-section"><h3>Scoring evidence &amp; caveats</h3><p class="source-note">${escapeHtml(character.evidence)}</p><a class="source-link" href="${escapeHtml(character.sourceUrl)}" target="_blank" rel="noreferrer">OPEN SOURCE PROFILE ↗</a><p class="source-note">Local source: ${escapeHtml(character.snapshotPath)}</p></section><div class="dialog-footer"><small>STATIC PROFILE SNAPSHOT · MANUALLY STRUCTURED</small><button type="button" class="set-fighter" data-dialog-set="one" data-character-id="${escapeHtml(character.id)}">USE AS FIGHTER 01</button><button type="button" class="set-fighter" data-dialog-set="two" data-character-id="${escapeHtml(character.id)}">USE AS FIGHTER 02</button></div></div>`;
  $("#profile-dialog").showModal();
}
function setView(view) {
  appState.activeView = view;
  $("#matchup-view").classList.toggle("is-visible", view === "matchup");
  $("#roster-view").classList.toggle("is-visible", view === "roster");
  $("#archive-view").classList.toggle("is-visible", view === "archive");
  $$(".nav-item").forEach(button => button.classList.toggle("is-active", button.dataset.view === view));
  $("#topbar-page").textContent = view === "matchup" ? "MATCHUP LAB" : view === "roster" ? "CHARACTER ROSTER" : "MATCH ARCHIVE";
  if (view === "roster") renderRoster();
  if (view === "archive") renderArchive();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function renderWeightList() {
  $("#weight-list").innerHTML = Object.entries(WEIGHTS).map(([key, value]) => `<div class="weight-item"><span>${escapeHtml(value.label)}</span><div class="weight-bar"><span style="width:${value.weight}%"></span></div><b>${value.weight}%</b></div>`).join("");
}
function bindEvents() {
  $$(".nav-item").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
  $("#back-to-matchup").addEventListener("click", () => setView("matchup"));
  $("#fighter-one-select").addEventListener("change", event => setFighter("one", event.target.value));
  $("#fighter-two-select").addEventListener("change", event => setFighter("two", event.target.value));
  $("#swap-fighters").addEventListener("click", () => {
    [appState.oneId, appState.twoId] = [appState.twoId, appState.oneId];
    renderAll();
  });
  $("#fight-button").addEventListener("click", renderResult);
  $("#roster-search").addEventListener("input", event => {
    appState.query = event.target.value;
    renderRoster();
  });
  $("#record-match-button").addEventListener("click", recordCurrentMatch);
  $("#export-archive-button").addEventListener("click", exportArchive);
  $("#archive-list").addEventListener("click", event => {
    if (event.target.closest("[data-go-matchup]")) setView("matchup");
  });
  $("#close-dialog").addEventListener("click", () => $("#profile-dialog").close());
  $("#close-model-dialog").addEventListener("click", () => $("#model-dialog").close());
  $("#open-model-notes").addEventListener("click", () => $("#model-dialog").showModal());
  $(".roster-grid").addEventListener("click", event => {
    const setButton = event.target.closest("[data-set-fighter]");
    const profileButton = event.target.closest("[data-open-profile]");
    if (setButton) {
      setFighter(setButton.dataset.setFighter, setButton.dataset.characterId);
      setView("matchup");
    } else if (profileButton) openProfile(profileButton.dataset.openProfile);
  });
  $("#dialog-content").addEventListener("click", event => {
    const button = event.target.closest("[data-dialog-set]");
    if (!button) return;
    setFighter(button.dataset.dialogSet, button.dataset.characterId);
    $("#profile-dialog").close();
    setView("matchup");
  });
  $$(".profile-link").forEach(button => button.addEventListener("click", () => openProfile(appState[`${button.dataset.profileSide}Id`])));
  for (const dialog of [$("#profile-dialog"), $("#model-dialog")]) {
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  }
}
async function initialize() {
  try {
    appState.matchRecords = readSavedMatches();
    const manifestResponse = await fetch("data/character-manifest.json");
    if (!manifestResponse.ok) throw new Error(`Character manifest request failed (${manifestResponse.status})`);
    const manifest = await manifestResponse.json();
    if (!Array.isArray(manifest.profiles)) throw new Error("The local character manifest must contain a profiles array.");
    const profileResults = await Promise.all(manifest.profiles.map(async path => {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Character profile request failed (${response.status}): ${path}`);
      return response.json();
    }));
    appState.characters = profileResults;
    if (appState.characters.length < 2) throw new Error("At least two profiles are required to compare fighters.");
    if (!byId(appState.oneId)) appState.oneId = appState.characters[0].id;
    if (!byId(appState.twoId) || appState.twoId === appState.oneId) appState.twoId = appState.characters.find(character => character.id !== appState.oneId).id;
    renderWeightList();
    renderAll();
    bindEvents();
  } catch (error) {
    document.querySelector("main").innerHTML = `<section class="load-error"><h1>Character profiles could not be loaded</h1><p>${escapeHtml(error.message)}</p><p>Open this static app through a local web server or GitHub Pages so it can fetch the local profile manifest and its listed JSON files.</p></section>`;
    console.error(error);
  }
}

initialize();
