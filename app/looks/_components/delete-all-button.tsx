import { deleteAllLooksAction } from '../actions';

export function DeleteAllButton() {
  return (
    <form action={deleteAllLooksAction}>
      <button type="submit">Delete all my looks</button>
    </form>
  );
}
