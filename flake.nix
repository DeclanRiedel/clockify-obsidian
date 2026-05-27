{
  description = "Clockify Obsidian plugin development shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      devShells = forAllSystems (system:
        let pkgs = nixpkgs.legacyPackages.${system};
        in {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_22
              pkgs.nodePackages.npm
              pkgs.git
            ];
            shellHook = ''
              echo "Clockify Obsidian"
              echo "  npm install"
              echo "  npm run dev"
              echo "  npm run check"
            '';
          };
        });

      apps = forAllSystems (system: {
        build = {
          type = "app";
          program = "${nixpkgs.legacyPackages.${system}.writeShellScript "clockify-obsidian-build" ''
            set -euo pipefail
            npm install
            npm run build
          ''}";
        };
        test = {
          type = "app";
          program = "${nixpkgs.legacyPackages.${system}.writeShellScript "clockify-obsidian-test" ''
            set -euo pipefail
            npm install
            npm run check
          ''}";
        };
      });
    };
}

