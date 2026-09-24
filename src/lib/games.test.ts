import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getAllCategories,
    getAllPublishers,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilteredGames(db: Database): Promise<{
    strategy: { id: number };
    puzzle: { id: number };
    rebase: { id: number };
    orbit: { id: number };
}> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'strategy' })
        .returning({ id: categories.id });
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'puzzle' })
        .returning({ id: categories.id });
    const [rebase] = await db
        .insert(publishers)
        .values({ name: 'Rebase Games', description: 'rebase' })
        .returning({ id: publishers.id });
    const [orbit] = await db
        .insert(publishers)
        .values({ name: 'Orbit Works', description: 'orbit' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Alpha Frontier',
            description: 'A strategy title',
            starRating: 4.6,
            categoryId: strategy.id,
            publisherId: rebase.id,
        },
        {
            title: 'Bravo Logic',
            description: 'Another strategy title',
            starRating: 4.2,
            categoryId: strategy.id,
            publisherId: orbit.id,
        },
        {
            title: 'Cinder Maze',
            description: 'A puzzle title',
            starRating: 3.9,
            categoryId: puzzle.id,
            publisherId: rebase.id,
        },
    ]);

    return { strategy, puzzle, rebase, orbit };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('filters games by category', async () => {
        const { strategy } = await seedFilteredGames(db);

        const filtered = await getAllGames(db, { categoryIds: [strategy.id] });

        expect(filtered.map((game) => game.title)).toEqual(['Alpha Frontier', 'Bravo Logic']);
    });

    it('filters games by publisher and category together', async () => {
        const { strategy, rebase } = await seedFilteredGames(db);

        const filtered = await getAllGames(db, {
            categoryIds: [strategy.id],
            publisherIds: [rebase.id],
        });

        expect(filtered.map((game) => game.title)).toEqual(['Alpha Frontier']);
    });

    it('lists categories and publishers in alphabetical order for filter controls', async () => {
        await seedFilteredGames(db);

        await expect(getAllCategories(db)).resolves.toEqual([
            { id: expect.any(Number), name: 'Puzzle' },
            { id: expect.any(Number), name: 'Strategy' },
        ]);
        await expect(getAllPublishers(db)).resolves.toEqual([
            { id: expect.any(Number), name: 'Orbit Works' },
            { id: expect.any(Number), name: 'Rebase Games' },
        ]);
    });
});
