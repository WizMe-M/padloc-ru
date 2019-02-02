import { API, CreateAccountParams, RecoverAccountParams, CreateVaultParams } from "./api";
import { Sender, RequestProgress } from "./transport";
import { DeviceInfo } from "./platform";
import { Session } from "./session";
import { Account, AccountID } from "./account";
import { Auth, EmailVerificationPurpose } from "./auth";
import { Invite } from "./invite";
import { Base64String } from "./encoding";
import { Vault } from "./vault";
import { Err, ErrorCode } from "./error";
import { Attachment } from "./attachment";

export interface ClientSettings {
    customServer: boolean;
    customServerUrl: string;
}

export interface ClientState {
    session: Session | null;
    account: Account | null;
    device: DeviceInfo;
    settings: ClientSettings;
}

export class Client implements API {
    constructor(public state: ClientState, private sender: Sender) {}

    get session() {
        return this.state.session;
    }

    async call(method: string, params?: any[], progress?: RequestProgress) {
        const { session } = this.state;

        const req = { method, params, device: this.state.device };

        if (session) {
            await session.authenticate(req);
        }

        let res;

        try {
            res = await this.sender.send(req, progress);
        } catch (e) {
            if (progress) {
                progress.error = e;
            }
            throw e;
        }

        if (res.error) {
            const err = new Err((res.error.code as any) as ErrorCode, res.error.message);
            if (progress) {
                progress.error = err;
            }
            throw err;
        }

        if (session && !(await session.verify(res))) {
            const err = new Err(ErrorCode.INVALID_RESPONSE);
            if (progress) {
                progress.error = err;
            }
            throw err;
        }

        return res;
    }

    async requestEmailVerification(params: { email: string; purpose?: EmailVerificationPurpose }) {
        const res = await this.call("requestEmailVerification", [params]);
        return res.result;
    }

    async completeEmailVerification(params: { email: string; code: string }) {
        const res = await this.call("completeEmailVerification", [params]);
        return res.result;
    }

    async initAuth(email: string) {
        const res = await this.call("initAuth", [{ email }]);
        const { auth, B } = res.result;
        return { auth: await new Auth(email).deserialize(auth), B };
    }

    async updateAuth(auth: Auth): Promise<void> {
        await this.call("updateAuth", [await auth.serialize()]);
    }

    async createSession(params: { account: AccountID; M: Base64String; A: Base64String }): Promise<Session> {
        const res = await this.call("createSession", [params]);
        return new Session().deserialize(res.result);
    }

    async revokeSession(session: Session): Promise<void> {
        await this.call("revokeSession", [{ id: session.id }]);
    }

    async createAccount(params: CreateAccountParams): Promise<Account> {
        const res = await this.call("createAccount", [
            {
                auth: await params.auth.serialize(),
                account: await params.account.serialize(),
                verify: params.verify,
                invite: params.invite
            }
        ]);
        return new Account().deserialize(res.result);
    }

    async getAccount(account: Account): Promise<Account> {
        const res = await this.call("getAccount");
        return await account.deserialize(res.result);
    }

    async updateAccount(account: Account): Promise<Account> {
        const res = await this.call("updateAccount", [await account.serialize()]);
        return account.deserialize(res.result);
    }

    async recoverAccount(params: RecoverAccountParams): Promise<Account> {
        const res = await this.call("recoverAccount", [
            {
                ...params,
                auth: await params.auth.serialize(),
                account: await params.account.serialize()
            }
        ]);
        return new Account().deserialize(res.result);
    }

    async getVault(vault: Vault): Promise<Vault> {
        const res = await this.call("getVault", [{ id: vault.id }]);
        return vault.deserialize(res.result);
    }

    async createVault(params: CreateVaultParams): Promise<Vault> {
        const res = await this.call("createVault", [params]);
        return new Vault("").deserialize(res.result);
    }

    async updateVault(vault: Vault): Promise<Vault> {
        const res = await this.call("updateVault", [await vault.serialize()]);
        return vault.deserialize(res.result);
    }

    async deleteVault(vault: Vault): Promise<void> {
        await this.call("deleteVault", [{ id: vault.id }]);
    }

    async getInvite(params: { vault: string; id: string }): Promise<Invite> {
        const res = await this.call("getInvite", [params]);
        return new Invite().deserialize(res.result);
    }

    async acceptInvite(invite: Invite): Promise<void> {
        await this.call("acceptInvite", [await invite.serialize()]);
    }

    async createAttachment(att: Attachment): Promise<Attachment> {
        att.uploadProgress = new RequestProgress();
        const { result } = await this.call("createAttachment", [await att.serialize()], att.uploadProgress);
        att.id = result.id;
        return att;
    }

    async getAttachment(att: Attachment): Promise<Attachment> {
        att.downloadProgress = new RequestProgress();
        const res = await this.call("getAttachment", [{ id: att.id, vault: att.vault }], att.downloadProgress);
        return att.deserialize(res.result);
    }

    async deleteAttachment(att: Attachment): Promise<void> {
        await this.call("deleteAttachment", [{ id: att.id, vault: att.vault }]);
    }
}
