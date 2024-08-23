const e = require('cors');
const fs = require('fs');
const path = require('path');
let pluginsDir = '';
const plugins = {};

// Initialize the plugins directory
function initializePluginsDir(appPath) {
  pluginsDir = path.join(appPath, 'Plugins');
  const pluginManagerFileName = 'pluginmanager.js';
  const pluginManagerSourcePath = path.join(__dirname, pluginManagerFileName);
  
  // Ensure the plugins directory exists
  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
  }
  
  // Path for the plugin manager file in the plugins directory
  const pluginManagerDestPath = path.join(pluginsDir, pluginManagerFileName);
  
  // Check if the plugin manager file is already present
  if (!fs.existsSync(pluginManagerDestPath)) {
    // Copy the plugin manager file to the plugins directory
    try {
      fs.copyFileSync(pluginManagerSourcePath, pluginManagerDestPath);
      console.log(`Plugin manager file copied to ${pluginManagerDestPath}`);
    } catch (err) {
      console.error(`Failed to copy plugin manager file: ${err.message}`);
    }
  }
}

// Load all plugins from the Plugins directory
function loadPlugins() {
  if (!pluginsDir) {
    throw new Error('Plugins directory not initialized.');
  }

  const files = fs.readdirSync(pluginsDir);
  files.forEach(file => {
    const filePath = path.join(pluginsDir, file);
    if (fs.statSync(filePath).isFile() && file.endsWith('.js')) {
      try {
        const plugin = require(filePath);
        if (plugin && typeof plugin === 'object' && plugin.commands) {
          // Merge commands into the main `plugins` object
          Object.assign(plugins, plugin.commands);
        }
      } catch (err) {
        console.error(`Failed to load plugin ${file}:`, err);
      }
    }
  });
}

// Retrieve a plugin command by its full command string
function getPluginCommand(fullCommand) {
  const [commandName, subcommandName] = fullCommand.split(' ');
  const command = plugins[commandName];
  if (command && subcommandName) {
    return command.subcommands.find(sub => sub.name === subcommandName) || null;
  }
  return command || null;
}

module.exports = {
  initializePluginsDir,
  loadPlugins,
  getPluginCommand,
};
