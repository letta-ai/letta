import { Button } from '@letta-web/component-library';
import { makeHello } from '$letta/client/test';

export default function Index() {
  /*
   * Replace the elements below with your own.
   *
   * Note: The corresponding styles are in the ./index.tailwind file.
   */
  return (
    <div>
      <div className="wrapper">
        <Button>{makeHello()}</Button>
      </div>
    </div>
  );
}
