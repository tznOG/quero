CREATE TABLE categories (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 40),
  name_key TEXT NOT NULL
);
CREATE UNIQUE INDEX categories_owner_name ON categories(user_id,name_key);

-- Seed existing accounts once. Deleting a category must never recreate it on login.
INSERT INTO categories(user_id,name,name_key)
SELECT p.id, d.name, d.name_key FROM profiles p CROSS JOIN (
  SELECT 'Tecnologia' AS name, 'tecnologia' AS name_key
  UNION ALL SELECT 'Moda','moda'
  UNION ALL SELECT 'Casa','casa'
  UNION ALL SELECT 'Beleza','beleza'
  UNION ALL SELECT 'Livros','livros'
  UNION ALL SELECT 'Experiências','experiências'
  UNION ALL SELECT 'Outros','outros'
) d;

-- Preserve any additional historical category without changing existing items.
INSERT OR IGNORE INTO categories(user_id,name,name_key)
SELECT DISTINCT w.user_id, i.category, lower(i.category)
FROM items i JOIN wishlists w ON w.id=i.wishlist_id
WHERE trim(i.category)<>'';

CREATE TRIGGER profiles_default_categories AFTER INSERT ON profiles BEGIN
  INSERT INTO categories(user_id,name,name_key) VALUES
    (NEW.id,'Tecnologia','tecnologia'),(NEW.id,'Moda','moda'),
    (NEW.id,'Casa','casa'),(NEW.id,'Beleza','beleza'),
    (NEW.id,'Livros','livros'),(NEW.id,'Experiências','experiências'),
    (NEW.id,'Outros','outros');
END;

-- Keep the existing text field and API contract. Empty text means no category.
-- Membership checks run inside the write, preventing stale forms and races.
CREATE TRIGGER items_category_insert BEFORE INSERT ON items
WHEN NEW.category<>'' AND NOT EXISTS (
  SELECT 1 FROM categories c JOIN wishlists w ON w.user_id=c.user_id
  WHERE w.id=NEW.wishlist_id AND c.name=NEW.category
) BEGIN SELECT RAISE(ABORT, 'invalid item category'); END;

CREATE TRIGGER items_category_update BEFORE UPDATE OF category,wishlist_id ON items
WHEN NEW.category<>'' AND NOT EXISTS (
  SELECT 1 FROM categories c JOIN wishlists w ON w.user_id=c.user_id
  WHERE w.id=NEW.wishlist_id AND c.name=NEW.category
) BEGIN SELECT RAISE(ABORT, 'invalid item category'); END;

CREATE TRIGGER categories_rename AFTER UPDATE OF name ON categories
WHEN OLD.name<>NEW.name BEGIN
  UPDATE items SET category=NEW.name WHERE category=OLD.name
    AND wishlist_id IN (SELECT id FROM wishlists WHERE user_id=NEW.user_id);
END;

CREATE TRIGGER categories_delete AFTER DELETE ON categories BEGIN
  UPDATE items SET category='' WHERE category=OLD.name
    AND wishlist_id IN (SELECT id FROM wishlists WHERE user_id=OLD.user_id);
END;
