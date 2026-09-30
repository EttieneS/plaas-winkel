<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\RbacSeeder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class RbacAuthTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_login_current_user_and_logout_preserve_existing_contract_and_use_real_bearer_tokens(): void
    {
        $this->seed(DatabaseSeeder::class);

        $login = $this->postJson('/api/auth/login', ['email' => 'ettiene@mercatur.test', 'password' => '12345']);

        $login->assertOk()->assertJsonPath('success', true)->assertJsonPath('data.user.roles', ['ADMIN'])
            ->assertJsonPath('data.user.permissions', [
                'cattle.create', 'cattle.reserve', 'cattle.view', 'permissions.assign', 'permissions.view', 'roles.assign', 'roles.create', 'roles.delete',
                'roles.edit', 'roles.view', 'users.create', 'users.delete', 'users.edit', 'users.view',
            ])->assertJsonMissingPath('data.user.password');
        $token = $login->json('data.token');
        $this->withToken($token)->getJson('/api/auth/user')->assertOk()
            ->assertJsonPath('data.email', 'ettiene@mercatur.test')
            ->assertJsonPath('data.roles', ['ADMIN'])->assertJsonMissingPath('data.user');
        $this->withToken($token)->postJson('/api/auth/logout')->assertOk()
            ->assertJsonPath('message', 'Logged out successfully.');
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_invalid_login_keeps_the_original_message_and_401(): void
    {
        $this->postJson('/api/auth/login', ['email' => 'missing@example.test', 'password' => 'wrong'])
            ->assertUnauthorized()->assertExactJson([
                'success' => false, 'message' => 'Invalid email or password.', 'data' => null,
            ]);
    }

    public function test_login_validation_uses_the_standard_error_envelope(): void
    {
        $this->postJson('/api/auth/login', [])->assertUnprocessable()
            ->assertJsonPath('success', false)->assertJsonPath('data', null)
            ->assertJsonStructure(['message', 'errors' => ['email', 'password']]);
    }

    public function test_effective_permissions_are_the_unique_union_of_multiple_roles(): void
    {
        $permission = Permission::factory()->create(['code' => 'users.view']);
        $first = Role::factory()->create(['code' => 'FARMER']);
        $second = Role::factory()->create(['code' => 'BUYER']);
        $first->permissions()->attach($permission);
        $second->permissions()->attach($permission);
        $user = User::factory()->create();
        $user->roles()->attach([$first->id, $second->id]);

        $this->assertTrue($user->hasRole('FARMER'));
        $this->assertFalse($user->hasRole('ADMIN'));
        $this->assertTrue($user->hasPermission('users.view'));
        $this->assertFalse($user->hasPermission('users.create'));
        $this->assertSame(['users.view'], $user->permissionCodes());
    }

    public function test_admin_code_alone_does_not_bypass_permissions(): void
    {
        $role = Role::factory()->create(['code' => 'ADMIN']);
        $user = User::factory()->create();
        $user->roles()->attach($role);

        $this->assertFalse($user->hasPermission('users.create'));
    }

    public function test_reseeding_does_not_duplicate_records_or_reset_an_existing_users_password(): void
    {
        $this->seed(DatabaseSeeder::class);
        $user = User::where('email', 'ettiene@mercatur.test')->firstOrFail();
        $user->update(['password' => 'changed-password']);

        $this->seed(DatabaseSeeder::class);

        $this->assertDatabaseCount('roles', 3);
        $this->assertDatabaseCount('permissions', 14);
        $this->assertDatabaseCount('role_permissions', 18);
        $this->assertDatabaseCount('user_roles', 1);
        $this->assertTrue(password_verify('changed-password', $user->fresh()->password));
    }

    public function test_permission_seeding_never_assigns_admin_to_a_user(): void
    {
        $user = User::factory()->create();

        $this->seed(RbacSeeder::class);

        $this->assertFalse($user->hasRole('ADMIN'));
        $this->assertDatabaseCount('user_roles', 0);
    }

    public function test_not_found_and_unexpected_errors_use_the_envelope_without_internal_details(): void
    {
        Route::get('/api/test-unexpected', function (): void {
            throw new \RuntimeException('Private connection credentials');
        });

        $this->getJson('/api/missing')->assertNotFound()->assertJsonPath('success', false)
            ->assertJsonPath('data', null);
        $this->getJson('/api/test-unexpected')->assertInternalServerError()
            ->assertExactJson([
                'success' => false,
                'message' => 'An unexpected server error occurred. Please try again.',
                'data' => null,
            ]);
    }

    public function test_reseeding_preserves_permission_ids_and_custom_role_grants(): void
    {
        $this->seed(RbacSeeder::class);
        $view = Permission::where('code', 'users.view')->firstOrFail();
        $buyer = Role::where('code', 'BUYER')->firstOrFail();
        $buyer->permissions()->attach($view);
        $custom = Permission::factory()->create(['code' => 'reports.view']);
        $admin = Role::where('code', 'ADMIN')->firstOrFail();
        $admin->permissions()->attach($custom);

        $this->seed(RbacSeeder::class);

        $this->assertSame($view->id, Permission::where('code', 'users.view')->firstOrFail()->id);
        $this->assertDatabaseHas('role_permissions', ['role_id' => $buyer->id, 'permission_id' => $view->id]);
        $this->assertDatabaseHas('role_permissions', ['role_id' => $admin->id, 'permission_id' => $custom->id]);
        $this->assertDatabaseCount('permissions', 15);
        $this->assertDatabaseCount('role_permissions', 20);
    }

    #[TestWith(['FARMER'])]
    #[TestWith(['BUYER'])]
    public function test_non_admin_roles_start_without_management_permissions_but_can_receive_a_specific_capability(string $code): void
    {
        $this->seed(RbacSeeder::class);
        $role = Role::where('code', $code)->firstOrFail();
        $user = User::factory()->create();
        $user->roles()->attach($role);
        Sanctum::actingAs($user);

        $this->assertSame($code === 'FARMER' ? ['cattle.create', 'cattle.view'] : ['cattle.reserve', 'cattle.view'], $user->permissionCodes());
        $this->getJson('/api/users')->assertForbidden();
        $role->permissions()->attach(Permission::where('code', 'users.view')->firstOrFail());

        $this->getJson('/api/users')->assertOk();
        $this->assertFalse($user->hasPermission('roles.create'));
        $this->assertFalse($user->hasPermission('permissions.assign'));
    }
}
