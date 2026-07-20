# Plugin Authoring Guide

KhedraX plugins are ordinary directories on disk that mirror the built-in registry layout.

## Required folder shape

A plugin root may contain any of the following subdirectories:

- agentTypes/ with entries containing agentType.json
- modules/ with entries containing module.json and the usual implementation/, configuration/, prompts/, tests/ files
- personas/ with entries containing persona.json
- memoryBackends/ with entries containing backend.json

Each entry should follow the same JSON shape as the built-in registry entries.

## Where to place a plugin root

Place the plugin directory anywhere on disk. A typical setup is a local checkout or an extracted package directory such as:

- /plugins/example-plugin
- ~/plugins/example-plugin

## How KhedraX discovers plugins

KhedraX accepts plugin roots in two ways:

- repeatable --plugin-path <dir> flags
- the KHEDRAX_PLUGIN_PATH environment variable, which accepts a colon-separated list of directories

The final order is environment variable entries first, followed by command-line flags.

## Collision rule

Built-in registry entries always win. Among plugins, the first plugin root scanned wins. Later collisions produce warnings and are skipped.
