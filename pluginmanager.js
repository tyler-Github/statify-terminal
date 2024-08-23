const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');

// Function to determine the plugins directory based on the operating system
function getPluginsDir() {
  let pluginsDir;

  switch (os.platform()) {
    case 'win32': // Windows
      pluginsDir = path.join(__dirname);
      break;
    case 'darwin': // macOS
    case 'linux': // Linux
      pluginsDir = path.join(os.homedir(), "Documents", "Statify-DB", "Plugins");
      break;
    default:
      throw new Error("Unsupported platform: " + os.platform());
  }

  return pluginsDir;
}

// Define the plugins directory based on the OS
const pluginsDir = getPluginsDir();
const currentFileName = path.basename(__filename); // The name of the current file

// Ensure the plugins directory exists
if (!fs.existsSync(pluginsDir)) {
  fs.mkdirSync(pluginsDir, { recursive: true });
}

// Utility function to check if a URL points to a .js file
function isJsFile(urlString) {
  try {
    const parsedUrl = new URL(urlString);
    return parsedUrl.pathname.endsWith('.js');
  } catch (err) {
    return false;
  }
}

// Utility function to download files
function downloadFile(urlString, dest) {
  return new Promise((resolve, reject) => {
    // Check if URL points to a .js file
    if (!isJsFile(urlString)) {
      return reject(new Error('URL does not point to a .js file.'));
    }

    const file = fs.createWriteStream(dest);
    https.get(urlString, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {}); // Ensure file deletion on error
      reject(err);
    });
  });
}

// Utility function to validate the format of a .js file
async function validateJsFile(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');

  // Define the expected format
  const expectedPattern = /\/\*\s*\*\s*@type\s*\{\s*Command\s*\}\s*\*\//;
  const validFormat = expectedPattern.test(fileContent);

  if (!validFormat) {
    fs.unlinkSync(filePath); // Remove file if not valid
    throw new Error('File does not match the required Command format.');
  }

  // Optionally: Perform further validation if needed (e.g., check module exports)
  try {
    const fileModule = { exports: {} };
    const script = new vm.Script(fileContent);
    const context = new vm.createContext({ module: fileModule, exports: fileModule.exports });
    script.runInContext(context);

    if (!fileModule.exports || typeof fileModule.exports !== 'object' || !fileModule.exports.commands) {
      fs.unlinkSync(filePath); // Remove file if exports are not valid
      throw new Error('File does not export the correct structure.');
    }

    // Further validation of commands structure
    const commands = fileModule.exports.commands;
    if (typeof commands !== 'object') {
      fs.unlinkSync(filePath); // Remove file if commands is not an object
      throw new Error('File exports an invalid commands structure.');
    }

    for (const key in commands) {
      const command = commands[key];
      if (typeof command !== 'object' ||
          typeof command.name !== 'string' ||
          typeof command.description !== 'string' ||
          !Array.isArray(command.subcommands) ||
          typeof command.execute !== 'function') {
        //fs.unlinkSync(filePath); // Remove file if command is invalid
        throw new Error('File contains invalid command structure.');
      }
    }

    return true;
  } catch (err) {
    //fs.unlinkSync(filePath); // Remove file on script execution errors
    throw new Error('Error executing file content: ' + err.message);
  }
}

/**
 * @type {Command}
 */
const pluginCommand = {
  name: 'plugin',
  description: 'Manages Statify plugins',
  subcommands: [
    {
      name: 'install',
      description: 'Installs a Statify plugin from a URL',
      subcommands: [],
      execute: async (args) => {
        if (args.length === 0) {
          return { text: 'Usage: plugin install <plugin-url>', type: 'error' };
        }

        const pluginUrl = args[0];
        const pluginFileName = path.basename(pluginUrl);
        const pluginDestination = path.join(pluginsDir, pluginFileName);

        console.log(pluginUrl)

        try {
          await downloadFile(pluginUrl, pluginDestination);
          //await validateJsFile(pluginDestination);
          return { text: `Plugin installed: ${pluginFileName}`, type: 'output' };
        } catch (error) {
          return { text: `Error installing plugin: ${error.message}`, type: 'error' };
        }
      },
    },
    {
      name: 'list',
      description: 'Lists all installed Statify plugins',
      subcommands: [],
      execute: async () => {
        try {
          const pluginFiles = fs.readdirSync(pluginsDir);
          if (pluginFiles.length === 0) {
            return { text: 'No plugins installed', type: 'output' };
          }
          return { text: `Installed plugins:\n${pluginFiles.join('\n')}`, type: 'output' };
        } catch (error) {
          return { text: `Error listing plugins: ${error.message}`, type: 'error' };
        }
      },
    },
    {
      name: 'uninstall',
      description: 'Uninstalls a Statify plugin by its filename',
      subcommands: [],
      execute: async (args) => {
        if (args.length === 0) {
          return { text: 'Usage: plugin uninstall <plugin-file>', type: 'error' };
        }
    
        // Properly handle the plugin filename by taking all arguments after 'uninstall'
        const pluginFileName = args
        //.join(' ').replace('uninstall', '').trim(); 
    
        if (!pluginFileName) {
          return { text: 'Please specify a valid plugin filename.', type: 'error' };
        }
    
        const pluginPath = path.join(pluginsDir, pluginFileName);
    
        if (pluginFileName === currentFileName) {
          return { text: `Cannot uninstall the plugin manager file: ${pluginFileName}`, type: 'error' };
        }
    
        try {
          if (fs.existsSync(pluginPath)) {
            fs.unlinkSync(pluginPath);
            return { text: `Plugin uninstalled: ${pluginFileName}`, type: 'output' };
          } else {
            return { text: `Plugin not found: ${pluginFileName}`, type: 'error' };
          }
        } catch (error) {
          return { text: `Error uninstalling plugin: ${error.message}`, type: 'error' };
        }
      },
    },    
    {
      name: 'help',
      description: 'Lists all available plugin manager commands or provides help on a specific command',
      subcommands: [],
      execute: async (args) => {
        if (args.length === 0) {
          return {
            text: pluginCommand.subcommands
              .map(cmd => `${cmd.name}: ${cmd.description}`)
              .join('\n'),
            type: 'output',
          };
        }

        const commandName = args[0];
        const command = pluginCommand.subcommands.find(cmd => cmd.name === commandName);
        if (command) {
          return { text: `${commandName}: ${command.description}`, type: 'output' };
        }

        return { text: `No help available for command "${commandName}".`, type: 'error' };
      },
    },
  ],
  execute: () => ({ text: 'This command has subcommands. Use "plugin <subcommand>"', type: 'error' }),
};

module.exports = {
  commands: {
    [pluginCommand.name]: pluginCommand
  }
};
