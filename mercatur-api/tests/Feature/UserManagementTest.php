<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\UserService;
use Database\Seeders\RbacSeeder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function admin(): User
    {
        $this->seed(RbacSeeder::class);
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('code', 'ADMIN')->firstOrFail());

        return $user;
    }

    private function payload(array $roles): array
    {
        return [
            'name' => 'New buyer',
            'email' => 'new@example.test',
            'password' => 'strong-password',
            'password_confirmation' => 'strong-password',
            'role_ids' => $roles,
        ];
    }

    #[TestWith(['GET', '/api/users'])]
    #[TestWith(['POST', '/api/users'])]
    #[TestWith(['GET', '/api/roles'])]
    public function test_returns_normalized_401_without_authentication(string $method, string $url): void
    {
        $this->json($method, $url)->assertUnauthorized()
            ->assertJsonPath('success', false)->assertJsonPath('data', null)->assertJsonStructure(['message']);
    }

    #[TestWith(['BUYER'])]
    #[TestWith(['FARMER'])]
    public function test_unprivileged_roles_cannot_read_or_create_users(string $code): void
    {
        $this->seed(RbacSeeder::class);
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('code', $code)->firstOrFail());
        Sanctum::actingAs($user);

        $this->getJson('/api/users')->assertForbidden()->assertJsonPath('success', false);
        $this->postJson('/api/users', $this->payload([$user->roles->first()->id]))
            ->assertForbidden()->assertJsonPath('message', 'You do not have permission to perform this action.');
        $this->getJson('/api/roles')->assertForbidden();
        $this->assertDatabaseCount('users', 1);
    }

    public function test_creates_a_user_with_multiple_roles_and_hashed_password(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $ids = Role::whereIn('code', ['BUYER', 'FARMER'])->pluck('id')->all();

        $response = $this->postJson('/api/users', $this->payload($ids));

        $response->assertCreated()->assertJsonPath('success', true)
            ->assertJsonPath('message', 'User created successfully.')
            ->assertJsonPath('data.roles', ['BUYER', 'FARMER'])
            ->assertJsonPath('data.permissions', [])
            ->assertJsonMissingPath('data.password')->assertJsonMissingPath('data.remember_token');
        $created = User::where('email', 'new@example.test')->firstOrFail();
        $this->assertTrue(password_verify('strong-password', $created->password));
        $this->assertNull($created->email_verified_at);
        foreach ($ids as $id) {
            $this->assertDatabaseHas('user_roles', ['user_id' => $created->id, 'role_id' => $id]);
        }
    }

    public function test_returns_a_paginated_user_list_with_roles_without_passwords(): void
    {
        Sanctum::actingAs($this->admin());
        User::factory()->count(26)->create();

        $response = $this->getJson('/api/users?page=2');

        $response->assertOk()->assertJsonCount(2, 'data.users')
            ->assertJsonPath('data.pagination.current_page', 2)
            ->assertJsonPath('data.pagination.total', 27)
            ->assertJsonMissingPath('data.users.0.password')
            ->assertJsonStructure(['success', 'message', 'data' => [
                'users' => [['id', 'name', 'email', 'roles', 'permissions']],
                'pagination',
            ]]);
    }

    public function test_duplicate_email_has_a_meaningful_validation_message(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $data = $this->payload([Role::where('code', 'BUYER')->firstOrFail()->id]);
        $data['email'] = $admin->email;

        $this->postJson('/api/users', $data)->assertUnprocessable()
            ->assertJsonPath('success', false)
            ->assertJsonPath('errors.email.0', 'The email address is already registered.');
        $this->assertDatabaseCount('users', 1);
    }

    #[TestWith(['role_ids', []])]
    #[TestWith(['role_ids', [999999]])]
    #[TestWith(['name', ' '])]
    #[TestWith(['email', 'invalid'])]
    #[TestWith(['password', 'short'])]
    #[TestWith(['password_confirmation', 'mismatch'])]
    #[TestWith(['permissions', ['users.delete']])]
    #[TestWith(['permission_ids', [1]])]
    #[TestWith(['email_verified_at', '2026-01-01'])]
    public function test_invalid_input_is_normalized_and_creates_nothing(string $field, mixed $value): void
    {
        Sanctum::actingAs($this->admin());
        $data = $this->payload([Role::where('code', 'BUYER')->firstOrFail()->id]);
        $data[$field] = $value;

        $this->postJson('/api/users', $data)->assertUnprocessable()
            ->assertJsonPath('success', false)->assertJsonPath('data', null)
            ->assertJsonStructure(['message', 'errors']);
        $this->assertDatabaseCount('users', 1);
    }

    public function test_duplicate_role_ids_are_rejected(): void
    {
        Sanctum::actingAs($this->admin());
        $id = Role::where('code', 'BUYER')->firstOrFail()->id;

        $this->postJson('/api/users', $this->payload([$id, $id]))->assertUnprocessable()
            ->assertJsonStructure(['errors' => ['role_ids.0']]);
        $this->assertDatabaseCount('users', 1);
    }

    public function test_creator_cannot_assign_roles_without_assignment_permission(): void
    {
        $this->seed(RbacSeeder::class);
        $role = Role::factory()->create();
        $role->permissions()->attach(Permission::where('code', 'users.create')->firstOrFail());
        $user = User::factory()->create();
        $user->roles()->attach($role);
        Sanctum::actingAs($user);

        $this->postJson('/api/users', $this->payload([Role::where('code', 'BUYER')->firstOrFail()->id]))
            ->assertForbidden();
        $this->assertDatabaseCount('users', 1);
    }

    public function test_role_assignment_cannot_escalate_beyond_the_actors_effective_permissions(): void
    {
        $this->seed(RbacSeeder::class);
        $role = Role::factory()->create();
        $role->permissions()->attach(Permission::whereIn('code', ['users.create', 'roles.assign', 'roles.view'])->pluck('id'));
        $actor = User::factory()->create();
        $actor->roles()->attach($role);
        Sanctum::actingAs($actor);
        $adminId = Role::where('code', 'ADMIN')->firstOrFail()->id;

        $this->getJson('/api/roles')->assertOk()->assertJsonMissing(['code' => 'ADMIN']);
        $this->postJson('/api/users', $this->payload([$adminId]))->assertForbidden()
            ->assertJsonPath('message', 'You cannot assign a role with permissions you do not hold.');
        $this->assertDatabaseCount('users', 1);

        $this->postJson('/api/users', $this->payload([Role::where('code', 'BUYER')->firstOrFail()->id]))
            ->assertCreated();
    }

    public function test_an_admin_can_assign_admin_through_database_permissions(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/users', $this->payload([Role::where('code', 'ADMIN')->firstOrFail()->id]))
            ->assertCreated()->assertJsonPath('data.roles', ['ADMIN'])
            ->assertJsonPath('data.permissions.0', 'permissions.assign');
    }

    public function test_permissions_revoked_in_the_database_are_enforced_on_the_next_request(): void
    {
        $user = $this->admin();
        Sanctum::actingAs($user);
        $this->getJson('/api/users')->assertOk();
        $user->roles()->detach();

        $this->getJson('/api/users')->assertForbidden();
    }

    public function test_database_uniqueness_failure_is_meaningful_and_atomic(): void
    {
        $actor = $this->admin();
        $data = $this->payload([Role::where('code', 'BUYER')->firstOrFail()->id]);
        $data['email'] = $actor->email;

        try {
            app(UserService::class)->create($actor, $data);
            $this->fail('Duplicate email should have been rejected.');
        } catch (ValidationException $exception) {
            $this->assertSame(['email' => ['The email address is already registered.']], $exception->errors());
        }

        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('user_roles', 1);
    }
}
