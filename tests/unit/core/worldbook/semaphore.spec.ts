import { Semaphore } from '@/novelToST/core/worldbook/semaphore';

describe('worldbook/semaphore', () => {
  it('should block acquire when reaching max concurrency until release', async () => {
    const semaphore = new Semaphore(1);

    await semaphore.acquire();
    let secondAcquired = false;

    const secondAcquire = semaphore.acquire().then(() => {
      secondAcquired = true;
    });

    await Promise.resolve();
    expect(secondAcquired).toBe(false);

    semaphore.release();
    await secondAcquire;

    expect(secondAcquired).toBe(true);
    expect(semaphore.activeCount).toBe(1);
  });

  it('should reject pending acquire calls after abort', async () => {
    const semaphore = new Semaphore(1);
    await semaphore.acquire();

    const pending = semaphore.acquire();
    semaphore.abort('STOPPED');

    await expect(pending).rejects.toThrow('STOPPED');
    await expect(semaphore.acquire()).rejects.toThrow('STOPPED');
  });
});
