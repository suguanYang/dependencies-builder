## The repositories

### Entries
When we want to analyze a repository, we need to know the entry files of the repository, this is the main files that will be analyzed by the codeQL.
For libs, its entry files are usually the index.ts or index.tsx, its main exports should be declared in the entry files.
For apps, its entry file usually are the mf exported files, typically is entry.tsx, its exported members are usually dependencies will be imported by others.

### webpack configs
For apps, its webpack configs are usually defined in the ./webpack.config.js file, it will be used to define the mf exposes and the remotes.
we can simple call this file to get the configurations of the mf plugin

### Libs configs
For libs, its config can be used to define the exports of the files, its usually defined in the ./sy.config.json file
The config can define the extra entry files that may be imported by others.