// Build and inspect local/Actions candidates. No network deployment or Release API.
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const targets = ['x86_64-pc-windows-msvc', 'aarch64-apple-darwin', 'x86_64-apple-darwin'];
const output = resolve(process.env.CANDIDATE_OUTPUT || await mkdtemp(join(tmpdir(), 'ditis-candidate-output-')));
await mkdir(output, { recursive: true });
const config = JSON.parse(await readFile(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const target = process.argv[2];
const json = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const execute = (command, args, options = {}) => spawnSync(command, args, { cwd: root, encoding: 'utf8', ...options });
function required(command, args, options) {
    const result = execute(command, args, options);
    if (result.error || result.status !== 0) throw new Error(`${command} failed (${result.status ?? 'unavailable'})`);
    return result;
}

if (target === '--aggregate') {
    const reports = [];
    for (const t of targets) {
        try { reports.push(JSON.parse(await readFile(join(output, `candidate-${t}.json`), 'utf8'))); }
        catch { reports.push({ target: t, built: false, error: 'Candidate report unavailable' }); }
    }
    const updaterReady = reports.every((r, index) => r.target === targets[index] && r.built && r.version === config.version && (!process.env.GITHUB_SHA || r.commit === process.env.GITHUB_SHA) && r.updater?.verified);
    const latest = { version: config.version, notes: 'Unpublished release candidate', pub_date: new Date().toISOString(), platforms: {} };
    for (const report of reports) {
        if (!report.updater?.verified) continue;
        const platform = report.target === targets[0] ? 'windows-x86_64' : report.target === targets[1] ? 'darwin-aarch64' : 'darwin-x86_64';
        const signature = report.updater.signature;
        if (typeof signature !== 'string' || !signature.trim()) throw new Error(`Missing updater signature: ${platform}`);
        const artifact = join(output, report.updater.file);
        const hash = createHash('sha256').update(await readFile(artifact)).digest('hex');
        if (hash !== report.updater.sha256) throw new Error(`Updater artifact hash mismatch: ${platform}`);
        latest.platforms[platform] = {
            signature,
            url: `https://github.com/${process.env.GITHUB_REPOSITORY || 'MisakiAkatsuki/ditis'}/releases/download/${config.version}/${encodeURIComponent(report.updater.file)}`,
        };
    }
    if (updaterReady && Object.keys(latest.platforms).length === 3) await json(join(output, 'latest.json'), latest);
    const distributionSigned = reports.every(r => r.target === targets[0] ? r.codeSignature === 'Valid' : r.codeSignature?.valid && r.codeSignature?.developerId && r.codeSignature?.notarized && r.codeSignature?.gatekeeperAccepted);
    await json(join(output, 'candidate-readiness.json'), {
        version: config.version, commit: process.env.GITHUB_SHA || null, published: false,
        packagesBuilt: reports.every(r => r.built), updaterSignaturesVerified: updaterReady,
        distributionSignaturesVerified: distributionSigned,
        updaterPackagesReady: updaterReady,
        readyForPublicRelease: false,
        readinessReason: 'Final Windows/macOS candidate installation and AE host checks are not recorded by this workflow.',
        finalArtifactManualValidation: { windows: 'unverified', macos: 'unverified' },
        signingPolicy: {
            updater: 'Existing configuration requires updater signatures verified with the configured public key.',
            distribution: 'Existing release workflow/configuration does not require Windows Authenticode or Apple Developer ID/notarization. These checks are informational and do not gate updaterPackagesReady.',
        },
        checks: reports,
        limits: ['Installation and AE host behavior require separate final-artifact validation.', 'latest.json is saved only as a workflow artifact; its future download URLs have not been deployed.'],
    });
    console.log(`Candidate report saved; updater signatures ${updaterReady ? 'verified' : 'unavailable/incomplete'}. Nothing published.`);
} else {
    const { run } = await import('@tauri-apps/cli');
    if (!targets.includes(target)) throw new Error('Expected one supported Windows/macOS target');
    const mac = target.endsWith('apple-darwin');
    const scratch = await mkdtemp(join(tmpdir(), 'ditis-candidate-check-'));
    // Keep build intermediates beside the deliverables, never in the repository
    // or inside the directory uploaded as the candidate workflow artifact.
    const cargoTarget = resolve(process.env.CARGO_TARGET_DIR || join(`${output}-build`, target));
    process.env.CARGO_TARGET_DIR = cargoTarget;
    const report = { target, version: config.version, commit: process.env.GITHUB_SHA || null, published: false, built: false, files: [] };
    try {
        const frontend = join(scratch, 'frontend');
        await mkdir(frontend, { recursive: true });
        await Promise.all([
            cp(join(root, 'js'), join(frontend, 'js'), { recursive: true }),
            cp(join(root, 'css'), join(frontend, 'css'), { recursive: true }),
            cp(join(root, 'index.html'), join(frontend, 'index.html')),
        ]);
        const updaterSigning = Boolean(process.env.TAURI_SIGNING_PRIVATE_KEY?.trim());
        const appleSigning = mac && ['APPLE_CERTIFICATE', 'APPLE_CERTIFICATE_PASSWORD', 'APPLE_ID', 'APPLE_PASSWORD', 'APPLE_TEAM_ID'].every(name => process.env[name]?.trim());
        // Empty secret strings are not valid credentials. Without complete Apple
        // credentials produce an explicitly ad-hoc candidate, never claim notarization.
        for (const name of ['TAURI_SIGNING_PRIVATE_KEY', 'TAURI_SIGNING_PRIVATE_KEY_PASSWORD', 'APPLE_CERTIFICATE', 'APPLE_CERTIFICATE_PASSWORD', 'APPLE_SIGNING_IDENTITY', 'APPLE_ID', 'APPLE_PASSWORD', 'APPLE_TEAM_ID']) {
            if (!process.env[name]?.trim() || (name.startsWith('APPLE_') && !appleSigning)) delete process.env[name];
        }
        const override = {
            build: { frontendDist: relative(join(root, 'src-tauri'), frontend), beforeBuildCommand: '' },
            bundle: { createUpdaterArtifacts: updaterSigning, ...(mac && !appleSigning ? { macOS: { signingIdentity: '-' } } : {}) },
        };
        report.updater = { requested: updaterSigning, verified: false, limitation: updaterSigning ? null : 'Updater signing credentials were unavailable; updater artifacts were disabled.' };
        if (mac && !appleSigning) report.signingLimitation = 'Apple distribution signing/notarization credentials were unavailable; candidate uses ad-hoc signing.';
        console.log(`Building ${target} candidate; updater signing ${updaterSigning ? 'enabled' : 'unavailable'}. Nothing published.`);
        await run(['build', '--target', target, '--bundles', mac ? 'app,dmg' : 'nsis', '--config', JSON.stringify(override), '--ci']);
        const bundle = join(cargoTarget, target, 'release/bundle');
        async function files(directory) {
            const result = [];
            for (const entry of await readdir(directory, { withFileTypes: true })) {
                const path = join(directory, entry.name);
                if (entry.isDirectory() && !entry.name.endsWith('.app')) result.push(...await files(path));
                else result.push(path);
            }
            return result;
        }
        const bundled = await files(bundle);
        const installer = bundled.find(p => basename(p).includes(config.version) && (mac ? p.endsWith('.dmg') : p.endsWith('-setup.exe')));
        if (!installer) throw new Error('Expected installer was not produced');
        const app = mac ? bundled.find(p => p.endsWith('.app')) : null;
        if (mac && !app) throw new Error('Expected macOS application was not produced');
        let updater = mac ? (updaterSigning ? bundled.find(p => p.endsWith('.app.tar.gz')) : null) : installer;
        if (mac && !updater) {
            updater = join(scratch, `${config.productName}.app.tar.gz`);
            required('tar', ['-czf', updater, '-C', resolve(app, '..'), basename(app)]);
        }
        for (const [path, suffix] of [[installer, mac ? '.dmg' : '-setup.exe'], ...(mac ? [[updater, '.app.tar.gz']] : [])]) {
            const name = `${config.productName}_${config.version}_${target}${suffix}`;
            await cp(path, join(output, name));
            report.files.push({ file: name, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
            if (path === updater) report.updater.file = name;
        }
        if (!mac) report.updater.file = report.files[0].file;
        if (updaterSigning) {
            const signature = (await readFile(updater + '.sig', 'utf8')).trim();
            const keyPath = join(scratch, 'updater.pub');
            const sigPath = join(scratch, 'updater.sig');
            await writeFile(keyPath, Buffer.from(config.plugins.updater.pubkey, 'base64'));
            await writeFile(sigPath, Buffer.from(signature, 'base64'));
            const verifierTarget = join(scratch, 'verifier');
            required('cargo', ['build', '--manifest-path', 'tools/updater-verifier/Cargo.toml', '--locked', '--release', '--target-dir', verifierTarget], { stdio: 'inherit' });
            required(join(verifierTarget, 'release', `ditis-updater-verifier${process.platform === 'win32' ? '.exe' : ''}`), [keyPath, updater, sigPath]);
            await writeFile(join(output, report.updater.file + '.sig'), signature + '\n');
            report.updater.signature = signature;
            report.updater.sha256 = createHash('sha256').update(await readFile(updater)).digest('hex');
            report.updater.verified = true;
        }
        if (mac) {
            required('hdiutil', ['verify', installer]);
            const signed = execute('codesign', ['--verify', '--deep', '--strict', app]);
            const detail = execute('codesign', ['-d', '--verbose=4', app]);
            const details = (detail.stdout || '') + (detail.stderr || '');
            const notarized = execute('xcrun', ['stapler', 'validate', app]);
            const accepted = execute('spctl', ['--assess', '--type', 'execute', app]);
            report.codeSignature = { valid: signed.status === 0, adHoc: /Signature=adhoc/.test(details), developerId: /Authority=Developer ID Application/.test(details), notarized: notarized.status === 0, gatekeeperAccepted: accepted.status === 0 };
            if (appleSigning && !report.codeSignature.notarized) throw new Error('Configured Apple candidate failed notarization validation');
        } else {
            const result = execute('powershell.exe', ['-NoProfile', '-Command', '(Get-AuthenticodeSignature -LiteralPath $env:DITIS_CANDIDATE_INSTALLER).Status.ToString()'], { env: { ...process.env, DITIS_CANDIDATE_INSTALLER: installer } });
            report.codeSignature = result.status === 0 && result.stdout?.trim() ? result.stdout.trim() : 'unavailable';
            if (report.codeSignature === 'unavailable') report.codeSignatureLimitation = 'Windows Authenticode status could not be read; this informational check does not fail the package build.';
        }
        report.built = true;
    } catch (error) {
        report.error = String(error.message || error);
        process.exitCode = 1;
        console.error(report.error);
    } finally {
        await json(join(output, `candidate-${target}.json`), report);
        const ownedTemp = relative(resolve(tmpdir()), resolve(scratch));
        if (!ownedTemp || isAbsolute(ownedTemp) || ownedTemp.startsWith('..')) throw new Error('Temporary cleanup path escaped the task temp directory');
        await rm(scratch, { recursive: true, force: true });
    }
}
