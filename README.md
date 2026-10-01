# Versus Archive — VS Battles Wiki Matchup Demo
## WIP
It's taking a lot out of me, but I'm attempting to build an app that can (mostly) accurately calculate fights from the VS wiki. Here is a current list of characters:

- Adam — Assassin's Creed
- Kyogai — Demon Slayer: Kimetsu No Yaiba
- Sabito — Demon Slayer: Kimetsu No Yaiba

## To-Do List
- Actual Matchup Simulation
- Clean Character Roster - I've been working on something to cleanly edit the profiles to prep for addition to the actual character db.
- Weights for stats - the following is something I cooked up in a previous attempt at this and needs work, but here is the general idea:
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

- Abilities adding other abilities - I see right off the bat that I'm going to struggle with this, but for instance, a Demon Slayer who knows total concentration breathing can have a resistance to poison among other things. 

- Items adding other abilitie

- Locations adding other abilitie
