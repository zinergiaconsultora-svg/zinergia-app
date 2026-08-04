import { readFileSync, readdirSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const sourceRoot = resolve(root, 'src');

const DIRECTORY_PROFILE_FIELDS = new Set([
    'id',
    'email',
    'full_name',
    'phone',
    'bio',
    'timezone',
    'role',
    'parent_id',
    'franchise_id',
    'created_at',
    'updated_at',
]);

const PROFILE_OPERATIONS = new Set(['select', 'insert', 'update', 'delete', 'upsert']);

type ProfileAccess = {
    key: string;
    file: string;
    functionName: string;
    operation: string;
    fields: string[];
    line: number;
};

function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === '__tests__') return [];
            return sourceFiles(path);
        }
        if (!['.ts', '.tsx'].includes(extname(path))) return [];
        if (/\.(?:test|spec)\.[^.]+$/.test(entry.name)) return [];
        if (entry.name === 'database.types.ts') return [];
        return [path];
    });
}

function enclosingFunctionName(node: ts.Node): string {
    let current: ts.Node | undefined = node;
    while (current) {
        if (
            (ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current))
            && current.name
        ) {
            return current.name.getText();
        }
        if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
            const initializer = current.initializer;
            if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
                return current.name.text;
            }
        }
        current = current.parent;
    }
    return '<module>';
}

function accessFields(call: ts.CallExpression, operation: string): string[] {
    const argument = call.arguments[0];
    if (!argument) return [];

    if (operation === 'select') {
        if (ts.isStringLiteralLike(argument)) {
            return argument.text.split(',').map((field) => field.trim()).filter(Boolean);
        }
        return [argument.getText().replace(/\s+/g, '')];
    }

    if (ts.isObjectLiteralExpression(argument)) {
        return argument.properties.map((property) => {
            if (ts.isSpreadAssignment(property)) return `...${property.expression.getText().replace(/\s+/g, '')}`;
            return property.name?.getText().replace(/["']/g, '') ?? property.getText().replace(/\s+/g, '');
        });
    }

    return [argument.getText().replace(/\s+/g, '')];
}

function directProfileAccesses(): ProfileAccess[] {
    const accesses: ProfileAccess[] = [];

    for (const absolutePath of sourceFiles(sourceRoot)) {
        const source = readFileSync(absolutePath, 'utf8');
        const sourceFile = ts.createSourceFile(
            absolutePath,
            source,
            ts.ScriptTarget.Latest,
            true,
            absolutePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );
        const file = relative(root, absolutePath).split(sep).join('/');

        function visit(node: ts.Node): void {
            if (
                ts.isCallExpression(node)
                && ts.isPropertyAccessExpression(node.expression)
                && node.expression.name.text === 'from'
                && node.arguments.length === 1
                && ts.isStringLiteralLike(node.arguments[0])
                && node.arguments[0].text === 'profiles'
                && ts.isPropertyAccessExpression(node.parent)
                && ts.isCallExpression(node.parent.parent)
            ) {
                const operation = node.parent.name.text;
                if (PROFILE_OPERATIONS.has(operation)) {
                    const operationCall = node.parent.parent;
                    const fields = accessFields(operationCall, operation);
                    const functionName = enclosingFunctionName(operationCall);
                    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
                    accesses.push({
                        key: `${file}::${functionName}::${operation}(${fields.join(',')})`,
                        file,
                        functionName,
                        operation,
                        fields,
                        line,
                    });
                }
            }
            ts.forEachChild(node, visit);
        }

        visit(sourceFile);
    }

    return accesses.sort((left, right) => left.key.localeCompare(right.key));
}

function embeddedProtectedProfileAccesses(): ProfileAccess[] {
    const accesses: ProfileAccess[] = [];

    for (const absolutePath of sourceFiles(sourceRoot)) {
        const source = readFileSync(absolutePath, 'utf8');
        const sourceFile = ts.createSourceFile(
            absolutePath,
            source,
            ts.ScriptTarget.Latest,
            true,
            absolutePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );
        const file = relative(root, absolutePath).split(sep).join('/');

        function visit(node: ts.Node): void {
            if (
                ts.isCallExpression(node)
                && ts.isPropertyAccessExpression(node.expression)
                && node.expression.name.text === 'select'
                && node.arguments[0]
                && ts.isStringLiteralLike(node.arguments[0])
            ) {
                const relation = /profiles(?:![A-Za-z0-9_]+|:[A-Za-z0-9_]+)?\s*\(([^()]*)\)/g;
                for (const match of node.arguments[0].text.matchAll(relation)) {
                    const fields = match[1].split(',').map((field) => field.trim()).filter(Boolean);
                    if (fields.every((field) => DIRECTORY_PROFILE_FIELDS.has(field))) continue;

                    const functionName = enclosingFunctionName(node);
                    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
                    accesses.push({
                        key: `${file}::${functionName}::select-embedded(${fields.join(',')})`,
                        file,
                        functionName,
                        operation: 'select-embedded',
                        fields,
                        line,
                    });
                }
            }
            ts.forEachChild(node, visit);
        }

        visit(sourceFile);
    }

    return accesses.sort((left, right) => left.key.localeCompare(right.key));
}

function isProtected(access: ProfileAccess): boolean {
    if (access.operation !== 'select') return true;
    if (access.fields.length === 0) return true;
    return access.fields.some((field) => !DIRECTORY_PROFILE_FIELDS.has(field));
}

const APPROVED_PURPOSE_SPECIFIC_ACCESSES = new Map<string, string>([
    [
        'src/app/actions/admin.ts::getAdminProfileAuthoritySummariesAction::select(id,email,full_name,role,parent_id,franchise_id,authority_version)',
        'Admin-only authority summary through the service client.',
    ],
    [
        'src/app/actions/commissionManagement.ts::getCommissionManagementDataAction::select-embedded(full_name,email,company_name,fiscal_verified)',
        'Admin-only commission-management projection through the service client.',
    ],
    [
        'src/app/actions/invoicing.ts::getInvoicingWorkspaceAction::select(role,fiscal_verified,invoice_tax_percent,nif_cif,fiscal_address,fiscal_city,fiscal_postal_code,iban)',
        'Authorized invoicing workspace loader through the service client.',
    ],
    [
        'src/app/actions/invoicing.ts::getOwnFiscalProfileAction::select(FISCAL_PROFILE_FIELDS)',
        'Own fiscal server reader; returns only masked IBAN metadata.',
    ],
    [
        'src/app/actions/invoicing.ts::updateFiscalProfileAction::update(...parsed.data,fiscal_verified,fiscal_verified_at,updated_at)',
        'Dedicated own fiscal writer with strict schema and verification invalidation.',
    ],
    [
        'src/app/actions/invoicing.ts::verifyFiscalProfileAction::update(fiscal_verified,fiscal_verified_at)',
        'Dedicated Admin fiscal-verification workflow.',
    ],
    [
        'src/app/actions/withdrawals.ts::createWithdrawalRequestAction::select(iban)',
        'Authorized internal full-IBAN existence check; value is never returned.',
    ],
    [
        'src/app/actions/withdrawals.ts::getOwnWalletIdentityAction::select(role,iban)',
        'Own wallet server reader; returns only hasIban and maskedIban.',
    ],
    [
        'src/lib/drive/folders.ts::resolveAgentFolder::select(drive_folder_id)',
        'Drive-system cache read through the service client.',
    ],
    [
        'src/lib/drive/folders.ts::resolveAgentFolder::select(full_name,drive_folder_id)',
        'Drive-system folder resolution through the service client.',
    ],
    [
        'src/lib/drive/folders.ts::resolveAgentFolder::update(drive_folder_id)',
        'Atomic Drive folder claim through the isolated service workflow.',
    ],
    [
        'src/lib/profile-authority/authoritySnapshot.ts::getProfileAuthoritySnapshot::select(id,role,parent_id,franchise_id,authority_version)',
        'Internal optimistic-concurrency snapshot through the service client.',
    ],
]);

// Keep this list explicit. Any entry here is a real Slice 2 dependency and keeps
// the contract RED until its consumer moves to a purpose-specific workflow.
const PENDING_PROFILE_DEPENDENCIES = new Set<string>([]);

describe('ZIN-SDD-041 T15 profiles access inventory contract', () => {
    it('allows only directory projections and explicitly approved purpose-specific workflows', () => {
        const protectedAccesses = [
            ...directProfileAccesses().filter(isProtected),
            ...embeddedProtectedProfileAccesses(),
        ].sort((left, right) => left.key.localeCompare(right.key));
        const discovered = new Set(protectedAccesses.map((access) => access.key));

        const staleAllowlist = [...APPROVED_PURPOSE_SPECIFIC_ACCESSES.keys()]
            .filter((key) => !discovered.has(key));
        expect(staleAllowlist, 'remove obsolete purpose-specific allowlist entries').toEqual([]);

        const unexplained = protectedAccesses
            .filter((access) => !APPROVED_PURPOSE_SPECIFIC_ACCESSES.has(access.key));

        expect(unexplained.map((access) => access.key)).toEqual([...PENDING_PROFILE_DEPENDENCIES]);
        expect(
            unexplained.map((access) => `${access.key} @L${access.line}`),
            'migrate every pending profiles dependency before the column-grant contract',
        ).toEqual([]);

    // This walks the whole src tree synchronously. 15s was enough when the suite was
    // smaller; under full parallel load it now times out and reds the gate without any
    // contract actually being violated. The number bounds a runaway scan, it is not an
    // assertion about how fast the filesystem is.
    }, 60_000);
});
