import { updatePassword } from "../auth/actions";
export default function Reset(){return <main className="mx-auto max-w-md p-8"><h1>Choose a new password</h1><form action={updatePassword}><input required minLength={12} name="password" type="password" aria-label="New password"/><button>Update password</button></form></main>}
