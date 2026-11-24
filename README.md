# Simulator Hub for OpenChamber

An OpenChamber rail extension for a Simulator Hub v1 server. The picture is an extension-owned viewport; the toolbar opens connection settings and, when an admin token is valid, device and client-token administration. The Hub remains the authority for access and control leases.

## Install

1. Use an OpenChamber version supporting shared surfaces and local extension services (the package declares 2.8.0 or newer). In **Settings → Extensions**, add this folder's absolute path and approve its local service.
2. In **Settings → Integrations → Extension accounts → Simulator Hub**, fill the Hub URL including `/v1`, the client token, and optionally the admin token in the named fields. Fields save on blur; leaving a saved secret blank does not clear it. Leave the generic Token/Connect field unused. Open **Simulator** and choose **Review URL** to approve the exact destination before credentials are sent. Approve it again if the URL changes.
3. Tap or drag directly on the picture; use the toolbar for Back and Home. A live drag holds exclusive control from pointer-down to pointer-up or cancellation. The lease expires if the viewer unexpectedly disappears.
4. **Simulator settings** opens the extension's settings page. A verified admin can start/stop the emulator, force-release a lease, and list or revoke client tokens there. Create tokens via the Hub admin API or CLI: the extension cannot securely display a newly issued secret in its sandboxed page.

The Hub requires a separate client token for viewing and input even when an admin token is configured. The extension supports one managed device, matching Hub v1. Admin operations affect the shared emulator and other clients.

## Security and limitations

- **Credentials live in OpenChamber’s integration settings**, not the extension page. The service reads the secret fields from the OpenChamber host. OpenChamber settings are shared at the instance level: anyone trusted to use this extension on the same instance can use its configured admin capability. Use a trusted OpenChamber instance and encrypted access to it.
- The service can read `SIMULATOR_HUB_BASE_URL`, `SIMULATOR_HUB_CLIENT_TOKEN`, and `SIMULATOR_HUB_ADMIN_TOKEN` in the Hub CLI, but **OpenChamber deliberately filters arbitrary environment variables before starting extension services**. Therefore environment auto-detection does not work under the documented host contract; native integration settings are required.
- Use HTTPS or an encrypted private tunnel for remote Hub connections. HTTP sends bearer tokens in cleartext unless the network transport is separately encrypted. The Hub must be reachable from the OpenChamber **server**, not merely the browser.
- On an upgraded Hub with scrcpy enabled, the service opens an authenticated **WSS** connection at the approved HTTPS URL plus `/live`. The browser never connects directly to the Hub. H.264 video is decoded in the rail with WebCodecs (secure context required). Touch down, move, up and cancel are sent while interacting; control is held for the contact, not for viewing. The Hub targets up to 30 fps at a maximum 1280-pixel long edge. Actual performance depends on the device, network and browser. Older Hubs, unavailable streams or unsupported browsers fall back to approximately 1 fps PNG with completed tap/swipe input. Keyboard support is HOME/BACK/ENTER only.
- This has not been tested against every OpenChamber version, remote deployment, or emulator rotation. VS Code and the mobile app do not load these extensions.

## Development

Requires Node.js and Bun. `bun install`, then `bun run build` after editing source. The bundled panel and service WebSocket client are included for folder installation. Run `node --test test/*.test.js` and `bunx openchamber-guest-check .`. Deploy the updated Hub first using its HTTPS instructions, then update the extension. The existing Hub URL approval and client/admin credentials do not change.
