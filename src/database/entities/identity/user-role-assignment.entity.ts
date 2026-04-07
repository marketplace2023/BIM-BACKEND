import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ResUser } from './res-user.entity';
import { UserRole } from './user-role.entity';
import { ResPartner } from './res-partner.entity';

@Entity('user_role_assignments')
@Index('uq_user_role_partner', ['user_id', 'role_id', 'partner_id'], {
  unique: true,
})
export class UserRoleAssignment {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  user_id: string;

  @ManyToOne(() => ResUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: ResUser;

  @Column({ type: 'bigint', unsigned: true })
  role_id: string;

  @ManyToOne(() => UserRole, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: UserRole;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  partner_id: string | null;

  @ManyToOne(() => ResPartner, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'partner_id' })
  partner: ResPartner | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
}
